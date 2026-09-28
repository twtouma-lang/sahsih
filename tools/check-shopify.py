#!/usr/bin/env python3
"""Checks what Shopify validates on upload and Theme Check does not.

  python3 tools/check-shopify.py

- every section schema: setting types, ids, defaults (range bounds and
  steps, select options, rich text markup, colours), blocks and presets
- every JSON template and section group: section types exist, settings and
  blocks match the schemas, orders are complete, group rules respected
- config/settings_schema.json and settings_data.json agree

Exits non-zero on any problem.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
THEME = ROOT / "shopify"
problems = []

INPUT_TYPES = {
    "checkbox", "number", "radio", "range", "select", "text", "textarea",
    "article", "blog", "collection", "collection_list", "color", "color_background",
    "color_scheme", "color_scheme_group", "font_picker", "html", "image_picker", "inline_richtext",
    "link_list", "liquid", "metaobject", "metaobject_list", "page", "product", "product_list",
    "richtext", "text_alignment", "url", "video", "video_url",
}
SIDEBAR_TYPES = {"header", "paragraph"}
RICH_TOP = re.compile(r"^(\s*<(p|ul|ol|h[1-6])(\s[^>]*)?>.*?</\2>\s*)+$", re.S)
HEX = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def problem(where, msg):
    problems.append(f"{where}: {msg}")


def load_json(path):
    text = path.read_text()
    text = re.sub(r"^\s*/\*.*?\*/", "", text, flags=re.S)
    return json.loads(text)


def check_value(where, setting, value):
    t = setting["type"]
    if t == "checkbox":
        if not isinstance(value, bool):
            problem(where, f"'{setting['id']}' must be true or false, got {value!r}")
    elif t in ("number",):
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            problem(where, f"'{setting['id']}' must be a number, got {value!r}")
    elif t == "range":
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            problem(where, f"'{setting['id']}' must be a number, got {value!r}")
        else:
            lo, hi, step = setting["min"], setting["max"], setting.get("step", 1)
            if not lo <= value <= hi:
                problem(where, f"'{setting['id']}' {value} is outside {lo}..{hi}")
            if abs(((value - lo) / step) - round((value - lo) / step)) > 1e-9:
                problem(where, f"'{setting['id']}' {value} is not on a step of {step} from {lo}")
    elif t in ("select", "radio"):
        options = [o["value"] for o in setting.get("options", [])]
        if value not in options:
            problem(where, f"'{setting['id']}' value {value!r} is not one of {options}")
    elif t == "richtext":
        if not isinstance(value, str) or (value and not RICH_TOP.match(value)):
            problem(where, f"'{setting['id']}' rich text must be wrapped in <p>, <ul>, <ol> or headings: {value!r:.80}")
    elif t in ("color", "color_background"):
        if t == "color" and (not isinstance(value, str) or not HEX.match(value)):
            problem(where, f"'{setting['id']}' must be a hex colour, got {value!r}")
    elif t in ("text", "textarea", "inline_richtext", "html", "liquid"):
        if not isinstance(value, str):
            problem(where, f"'{setting['id']}' must be a string, got {value!r}")
        if t == "text" and isinstance(value, str) and "\n" in value:
            problem(where, f"'{setting['id']}' text settings cannot contain line breaks")
    elif t == "url":
        if not isinstance(value, str):
            problem(where, f"'{setting['id']}' must be a string")
    elif t in ("product", "collection", "page", "blog", "article", "link_list"):
        if not isinstance(value, str):
            problem(where, f"'{setting['id']}' must be a handle string")


def check_setting_defs(where, settings):
    ids = set()
    for s in settings:
        t = s.get("type")
        if t in SIDEBAR_TYPES:
            if "content" not in s:
                problem(where, f"{t} without content")
            continue
        if t not in INPUT_TYPES:
            problem(where, f"unknown setting type {t!r}")
            continue
        sid = s.get("id")
        if not sid:
            problem(where, f"{t} setting without id")
            continue
        if sid in ids:
            problem(where, f"duplicate setting id {sid!r}")
        ids.add(sid)
        if "label" not in s:
            problem(where, f"'{sid}' has no label")
        if t == "range":
            for k in ("min", "max", "default"):
                if k not in s:
                    problem(where, f"range '{sid}' needs {k}")
            steps = (s["max"] - s["min"]) / s.get("step", 1)
            if steps > 101:
                problem(where, f"range '{sid}' has {steps:.0f} steps (max 101)")
        if t in ("select", "radio") and not s.get("options"):
            problem(where, f"'{sid}' has no options")
        if t == "url" and "default" in s and s["default"] not in ("/collections", "/collections/all"):
            problem(where, f"url '{sid}' default must be /collections or /collections/all")
        if t == "link_list" and "default" in s and s["default"] not in ("main-menu", "footer"):
            problem(where, f"link_list '{sid}' default must be main-menu or footer")
        if t in ("product", "collection", "page", "blog", "article", "image_picker", "video") and "default" in s:
            problem(where, f"'{sid}' ({t}) cannot have a default")
        if "default" in s:
            check_value(where + " default", s, s["default"])
    return {s["id"]: s for s in settings if s.get("type") in INPUT_TYPES and s.get("id")}


def section_schemas():
    out = {}
    for f in sorted((THEME / "sections").glob("*.liquid")):
        text = f.read_text()
        m = re.search(r"{%-?\s*schema\s*-?%}(.*?){%-?\s*endschema\s*-?%}", text, re.S)
        if not m:
            out[f.stem] = None  # rendered with {% render %} or the Section Rendering API only
            continue
        try:
            schema = json.loads(m.group(1))
        except json.JSONDecodeError as e:
            problem(f"sections/{f.name}", f"schema is not valid JSON: {e}")
            continue
        out[f.stem] = schema
    return out


def check_schema(name, schema):
    where = f"sections/{name}.liquid"
    if "name" not in schema:
        problem(where, "schema has no name")
    if schema.get("tag") and schema["tag"] not in ("article", "aside", "div", "footer", "header", "section"):
        problem(where, f"tag {schema['tag']!r} not allowed")
    if "enabled_on" in schema and "disabled_on" in schema:
        problem(where, "cannot have both enabled_on and disabled_on")
    if "limit" in schema and schema["limit"] not in (1, 2):
        problem(where, "limit must be 1 or 2")
    settings = check_setting_defs(where, schema.get("settings", []))
    blocks = {}
    for b in schema.get("blocks", []):
        if b.get("type") == "@app":
            blocks["@app"] = {}
            continue
        if "name" not in b:
            problem(where, f"block {b.get('type')} has no name")
        blocks[b["type"]] = check_setting_defs(f"{where} block {b['type']}", b.get("settings", []))
    if schema.get("max_blocks", 50) > 50:
        problem(where, "max_blocks above 50")
    for i, preset in enumerate(schema.get("presets", [])):
        pw = f"{where} preset {i}"
        if "name" not in preset:
            problem(pw, "no name")
        for k, v in preset.get("settings", {}).items():
            if k not in settings:
                problem(pw, f"unknown setting {k!r}")
            else:
                check_value(pw, settings[k], v)
        pblocks = preset.get("blocks", [])
        if isinstance(pblocks, dict):
            pblocks = list(pblocks.values())
        if len(pblocks) > schema.get("max_blocks", 50):
            problem(pw, "more blocks than max_blocks")
        for b in pblocks:
            if b["type"] not in blocks:
                problem(pw, f"unknown block type {b['type']!r}")
                continue
            for k, v in b.get("settings", {}).items():
                if k not in blocks[b["type"]]:
                    problem(pw, f"block {b['type']} unknown setting {k!r}")
                else:
                    check_value(pw, blocks[b["type"]][k], v)
    return settings, blocks


def check_section_instance(where, key, data, schemas, parsed, group=None):
    t = data.get("type")
    if t not in schemas:
        problem(where, f"section {key!r} uses missing section type {t!r}")
        return
    schema = schemas[t]
    if schema is None:
        problem(where, f"section {key!r} type {t!r} has no schema")
        return
    if group:
        en = schema.get("enabled_on", {}).get("groups")
        dis = schema.get("disabled_on", {}).get("groups", [])
        if en is not None and group not in en and "*" not in en:
            problem(where, f"{t} is not enabled in the {group} group")
        if group in dis or "*" in dis:
            problem(where, f"{t} is disabled in the {group} group")
    else:
        en = schema.get("enabled_on", {}).get("templates")
        if schema.get("enabled_on", {}).get("groups") and en is None:
            problem(where, f"{t} is only enabled in groups")
    settings, blocks = parsed[t]
    for k, v in data.get("settings", {}).items():
        if k not in settings:
            problem(where, f"{key}: unknown setting {k!r}")
        else:
            check_value(f"{where} {key}", settings[k], v)
    bdata = data.get("blocks", {})
    order = data.get("block_order", [])
    if set(order) != set(bdata):
        problem(where, f"{key}: block_order {order} does not match blocks {list(bdata)}")
    if len(bdata) > schema.get("max_blocks", 50):
        problem(where, f"{key}: more blocks than max_blocks")
    counts = {}
    for bk, b in bdata.items():
        bt = b.get("type")
        counts[bt] = counts.get(bt, 0) + 1
        if bt not in blocks:
            problem(where, f"{key}: block {bk!r} unknown type {bt!r}")
            continue
        for k, v in b.get("settings", {}).items():
            if k not in blocks[bt]:
                problem(where, f"{key}: block {bk} unknown setting {k!r}")
            else:
                check_value(f"{where} {key}.{bk}", blocks[bt][k], v)
    for bdef in schema.get("blocks", []):
        if "limit" in bdef and counts.get(bdef["type"], 0) > bdef["limit"]:
            problem(where, f"{key}: more than {bdef['limit']} {bdef['type']} blocks")


def main():
    schemas = section_schemas()
    parsed = {name: check_schema(name, s) for name, s in schemas.items() if s is not None}

    for f in sorted((THEME / "templates").glob("*.json")):
        where = f"templates/{f.name}"
        data = load_json(f)
        secs = data.get("sections", {})
        if set(data.get("order", [])) != set(secs):
            problem(where, "order does not list exactly the sections")
        if len(secs) > 25:
            problem(where, "more than 25 sections")
        if data.get("layout") not in (None, False, "theme", "password"):
            problem(where, f"unknown layout {data.get('layout')!r}")
        for key, sec in secs.items():
            check_section_instance(where, key, sec, schemas, parsed)
            limit = (schemas.get(sec.get("type")) or {}).get("limit")
            if limit and sum(1 for s in secs.values() if s.get("type") == sec.get("type")) > limit:
                problem(where, f"more than {limit} {sec.get('type')} sections")

    for f in sorted((THEME / "sections").glob("*.json")):
        where = f"sections/{f.name}"
        data = load_json(f)
        group = data.get("type")
        if group not in ("header", "footer", "aside") and not str(group).startswith("custom."):
            problem(where, f"group type {group!r}")
        if "name" not in data:
            problem(where, "group has no name")
        secs = data.get("sections", {})
        if set(data.get("order", [])) != set(secs):
            problem(where, "order does not list exactly the sections")
        for key, sec in secs.items():
            check_section_instance(where, key, sec, schemas, parsed, group=group)

    schema = json.loads((THEME / "config" / "settings_schema.json").read_text())
    if schema[0].get("name") != "theme_info":
        problem("settings_schema.json", "first entry must be theme_info")
    all_settings = {}
    for group in schema[1:]:
        all_settings.update(check_setting_defs(f"settings_schema.json {group.get('name')}", group.get("settings", [])))
    data = load_json(THEME / "config" / "settings_data.json")
    current = data.get("current")
    values = data["presets"][current] if isinstance(current, str) else current
    for k, v in values.items():
        if k in ("sections", "content_for_index", "blocks"):
            continue
        if k not in all_settings:
            problem("settings_data.json", f"unknown setting {k!r}")
        else:
            check_value("settings_data.json", all_settings[k], v)

    # Every translation key in the schema-free locale is valid JSON already;
    # check the locale file parses and has no empty strings.
    loc = json.loads((THEME / "locales" / "en.default.json").read_text())

    def walk(node, path=""):
        for k, v in node.items():
            if isinstance(v, dict):
                walk(v, f"{path}{k}.")
            elif not isinstance(v, str) or not v.strip():
                problem("locales/en.default.json", f"{path}{k} is empty")

    walk(loc)

    if problems:
        print("\n".join(problems))
        print(f"\n{len(problems)} problem(s)")
        sys.exit(1)
    print(f"OK: {len(schemas)} sections, {len(list((THEME / 'templates').glob('*.json')))} JSON templates, "
          f"{len(all_settings)} theme settings checked")


if __name__ == "__main__":
    main()
