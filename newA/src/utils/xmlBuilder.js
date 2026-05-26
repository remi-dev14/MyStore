export function buildXml(rootTag, data) {
  const inner = objToXml(data);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<${rootTag}>\n${inner}\n</${rootTag}>\n</prestashop>`;
}

function objToXml(obj, indent = '  ') {
  return Object.entries(obj)
    .map(([key, value]) => {
      if (value === null || value === undefined) return `${indent}<${key}/>`;
      if (Array.isArray(value)) {
        return value.map((v) => `${indent}<${key}>${valueToXml(v, indent)}</${key}>`).join('\n');
      }
      return `${indent}<${key}>${valueToXml(value, indent)}</${key}>`;
    })
    .join('\n');
}

function valueToXml(value, indent) {
  if (typeof value === 'object' && value !== null) {
    return '\n' + objToXml(value, indent + '  ') + '\n' + indent;
  }
  return String(value);
}

export function buildLangField(tag, values, indent = '  ') {
  const langs = Object.entries(values)
    .map(([id, text]) => `${indent}  <language id="${id}"><![CDATA[${text}]]></language>`)
    .join('\n');
  return `${indent}<${tag}>\n${langs}\n${indent}</${tag}>`;
}

export function buildProductXml({ name, reference, price, wholesale_price, id_tax_rules_group, id_category_default, available_date, active = 1 }) {
  const safeDate = available_date && available_date !== 'undefined' ? available_date : '0000-00-00';
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
<product>
  <id_manufacturer>0</id_manufacturer>
  <id_supplier>0</id_supplier>
  <id_category_default>${id_category_default}</id_category_default>
  <reference><![CDATA[${reference}]]></reference>
  <price>${price}</price>
  <wholesale_price>${wholesale_price}</wholesale_price>
  <id_tax_rules_group>${id_tax_rules_group}</id_tax_rules_group>
  <state>1</state>
  <active>${active}</active>
  <available_for_order>1</available_for_order>
  <show_price>1</show_price>
  <visibility>both</visibility>
  <available_date>${safeDate}</available_date>
  <name>
    <language id="1"><![CDATA[${name}]]></language>
    <language id="2"><![CDATA[${name}]]></language>
  </name>
  <description><language id="1"><![CDATA[]]></language><language id="2"><![CDATA[]]></language></description>
  <description_short><language id="1"><![CDATA[]]></language><language id="2"><![CDATA[]]></language></description_short>
  <link_rewrite><language id="1"><![CDATA[${slugify(name)}]]></language><language id="2"><![CDATA[${slugify(name)}]]></language></link_rewrite>
  <meta_title><language id="1"><![CDATA[]]></language><language id="2"><![CDATA[]]></language></meta_title>
  <meta_description><language id="1"><![CDATA[]]></language><language id="2"><![CDATA[]]></language></meta_description>
  <meta_keywords><language id="1"><![CDATA[]]></language><language id="2"><![CDATA[]]></language></meta_keywords>
  <associations>
    <categories>
      <category><id>${id_category_default}</id></category>
    </categories>
  </associations>
</product>
</prestashop>`;
}

export function buildCustomerXml({ firstname, lastname, email, passwd, id_default_group = 3, id_lang = 1, id_shop = 1, id_shop_group = 1, id_gender = 1 }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
<customer>
  <id_default_group>${id_default_group}</id_default_group>
  <id_lang>${id_lang}</id_lang>
  <id_shop>${id_shop}</id_shop>
  <id_shop_group>${id_shop_group}</id_shop_group>
  <id_gender>${id_gender}</id_gender>
  <lastname><![CDATA[${lastname}]]></lastname>
  <firstname><![CDATA[${firstname}]]></firstname>
  <email><![CDATA[${email}]]></email>
  <passwd><![CDATA[${passwd}]]></passwd>
  <active>1</active>
  <newsletter>0</newsletter>
  <optin>0</optin>
  <date_add>2000-01-01 00:00:00</date_add>
  <date_upd>2000-01-01 00:00:00</date_upd>
</customer>
</prestashop>`;
}

export function buildAddressXml({ id_customer, alias, address1, city, id_country = 8, id_state = 0, postcode = '00000', firstname, lastname }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
<address>
  <id_customer>${id_customer}</id_customer>
  <id_country>${id_country}</id_country>
  <id_state>${id_state}</id_state>
  <alias><![CDATA[${alias}]]></alias>
  <lastname><![CDATA[${lastname}]]></lastname>
  <firstname><![CDATA[${firstname}]]></firstname>
  <address1><![CDATA[${address1}]]></address1>
  <city><![CDATA[${city}]]></city>
  <postcode>${postcode}</postcode>
  <phone>0000000000</phone>
</address>
</prestashop>`;
}

export function buildCartXml({ id_customer, id_address_delivery, id_address_invoice, cartRows = [], id_currency = 1, id_lang = 1, id_carrier = 1, id_shop = 1, id_shop_group = 1 }) {
  const rowsXml = cartRows.map((row) => `
    <cart_row>
      <id_product>${row.product_id}</id_product>
      <id_product_attribute>${row.product_attribute_id ?? 0}</id_product_attribute>
      <quantity>${row.quantity}</quantity>
      <id_shop>${row.id_shop ?? 1}</id_shop>
    </cart_row>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
<cart>
  <id_currency>${id_currency}</id_currency>
  <id_lang>${id_lang}</id_lang>
  <id_customer>${id_customer}</id_customer>
  <id_carrier>${id_carrier}</id_carrier>
  <id_shop>${id_shop}</id_shop>
  <id_shop_group>${id_shop_group}</id_shop_group>
  <id_address_delivery>${id_address_delivery}</id_address_delivery>
  <id_address_invoice>${id_address_invoice}</id_address_invoice>
  <associations>
    <cart_rows>${rowsXml}
    </cart_rows>
  </associations>
</cart>
</prestashop>`;
}

export function buildOrderXml({ id_customer, id_cart, id_address_delivery, id_address_invoice, orderRows = [], id_currency = 1, id_lang = 1, id_carrier = 1, id_shop = 1, id_shop_group = 1, current_state = 2, payment = 'Cash on delivery', module = 'cod', total_paid, total_paid_real, total_paid_tax_incl = 0, total_paid_tax_excl = 0, total_products, total_products_wt, total_shipping = 0, total_shipping_tax_incl = 0, total_shipping_tax_excl = 0, conversion_rate = 1 }) {
  const rowsXml = orderRows.map((row) => `
    <order_row>
      <product_id>${row.product_id}</product_id>
      <product_attribute_id>${row.product_attribute_id ?? 0}</product_attribute_id>
      <product_quantity>${row.quantity}</product_quantity>
      <product_name><![CDATA[${row.product_name}]]></product_name>
      <product_reference><![CDATA[${row.product_reference}]]></product_reference>
      <product_price>${row.product_price}</product_price>
      <unit_price_tax_incl>${row.unit_price_tax_incl}</unit_price_tax_incl>
      <unit_price_tax_excl>${row.unit_price_tax_excl}</unit_price_tax_excl>
      <id_customization>${row.id_customization ?? 0}</id_customization>
    </order_row>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
<order>
  <id_address_delivery>${id_address_delivery}</id_address_delivery>
  <id_address_invoice>${id_address_invoice}</id_address_invoice>
  <id_cart>${id_cart}</id_cart>
  <id_currency>${id_currency}</id_currency>
  <id_lang>${id_lang}</id_lang>
  <id_customer>${id_customer}</id_customer>
  <id_carrier>${id_carrier}</id_carrier>
  <id_shop>${id_shop}</id_shop>
  <id_shop_group>${id_shop_group}</id_shop_group>
  <current_state>${current_state}</current_state>
  <module><![CDATA[${module}]]></module>
  <payment><![CDATA[${payment}]]></payment>
  <conversion_rate>${conversion_rate}</conversion_rate>
  <total_paid>${total_paid}</total_paid>
  <total_paid_real>${total_paid_real}</total_paid_real>
  <total_paid_tax_incl>${total_paid_tax_incl}</total_paid_tax_incl>
  <total_paid_tax_excl>${total_paid_tax_excl}</total_paid_tax_excl>
  <total_products>${total_products}</total_products>
  <total_products_wt>${total_products_wt}</total_products_wt>
  <total_shipping>${total_shipping}</total_shipping>
  <total_shipping_tax_excl>${total_shipping_tax_excl}</total_shipping_tax_excl>
  <total_shipping_tax_incl>${total_shipping_tax_incl}</total_shipping_tax_incl>
  <total_wrapping>0</total_wrapping>
  <total_wrapping_tax_excl>0</total_wrapping_tax_excl>
  <total_wrapping_tax_incl>0</total_wrapping_tax_incl>
  <associations>
    <order_rows>${rowsXml}
    </order_rows>
  </associations>
</order>
</prestashop>`;
}

export function buildCategoryXml({ name, id_parent = 2, active = 1 }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
<category>
  <id_parent>${id_parent}</id_parent>
  <active>${active}</active>
  <name>
    <language id="1"><![CDATA[${name}]]></language>
    <language id="2"><![CDATA[${name}]]></language>
  </name>
  <link_rewrite>
    <language id="1"><![CDATA[${slugify(name)}]]></language>
    <language id="2"><![CDATA[${slugify(name)}]]></language>
  </link_rewrite>
  <description>
    <language id="1"><![CDATA[]]></language>
    <language id="2"><![CDATA[]]></language>
  </description>
</category>
</prestashop>`;
}

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
