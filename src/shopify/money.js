/* Money formatting with the store's own format (Settings > General), for
 * totals the page works out itself (price x quantity). Every other price on
 * the page is formatted by Shopify on the server. */
const decoder = typeof document !== 'undefined' ? document.createElement('textarea') : null;

/* Price strings and formats may contain HTML entities such as &euro;. */
export function decodeEntities(text) {
  if (!decoder || typeof text !== 'string' || !text.includes('&')) return text;
  decoder.innerHTML = text;
  return decoder.value;
}

function delimit(value, precision, thousands, decimal) {
  const [int, dec] = value.toFixed(precision).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  return dec ? grouped + decimal + dec : grouped;
}

export function formatMoney(cents, format) {
  const fmt = decodeEntities(String(format || '${{amount}}').replace(/<[^>]*>/g, ''));
  const value = Number(cents || 0) / 100;
  const match = fmt.match(/\{\{\s*(\w+)\s*\}\}/);
  const kind = match ? match[1] : 'amount';
  let out;
  switch (kind) {
    case 'amount_no_decimals':
      out = delimit(value, 0, ',', '.');
      break;
    case 'amount_with_comma_separator':
      out = delimit(value, 2, '.', ',');
      break;
    case 'amount_no_decimals_with_comma_separator':
      out = delimit(value, 0, '.', ',');
      break;
    case 'amount_with_apostrophe_separator':
      out = delimit(value, 2, "'", '.');
      break;
    case 'amount_no_decimals_with_space_separator':
      out = delimit(value, 0, ' ', '');
      break;
    case 'amount_with_space_separator':
      out = delimit(value, 2, ' ', ',');
      break;
    case 'amount_with_period_and_space_separator':
      out = delimit(value, 2, ' ', '.');
      break;
    default:
      out = delimit(value, 2, ',', '.');
  }
  return match ? fmt.replace(match[0], out) : out;
}
