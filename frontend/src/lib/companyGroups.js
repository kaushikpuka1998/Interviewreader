// How companies are grouped on the Problems page. Names must match the problem bank exactly
// (e.g. "Linkedin", "Walmart Labs", "Capital ONE"). A company not listed here shows under "Other".
// Listing a company that has no problems yet is harmless: empty sub-groups are hidden.
export const COMPANY_GROUPS = [
  {
    id: 'product', label: 'Product-based',
    subgroups: [
      { id: 'faang', label: 'FAANG / MAANG', companies: ['Google', 'Amazon', 'Meta', 'Apple', 'Netflix', 'Microsoft'] },
      { id: 'tier1', label: 'Tier 1', companies: [
        'Bloomberg', 'Tiktok', 'Bytedance', 'Oracle', 'Uber', 'Salesforce', 'Linkedin', 'Adobe', 'Nvidia', 'Snowflake',
        'Databricks', 'Airbnb', 'Stripe', 'Atlassian', 'Doordash', 'Pinterest', 'Snapchat', 'Twitter', 'Lyft', 'Palantir',
        'Rubrik', 'Coinbase', 'Openai', 'Tesla', 'Servicenow', 'Intuit', 'Walmart Labs', 'Spotify', 'Roblox', 'Rippling',
        'Confluent', 'Datadog', 'Cloudflare', 'Dropbox', 'Robinhood', 'Arista Networks', 'Nutanix', 'Palo Alto Networks',
        'Crowdstrike', 'Mongodb', 'Workday', 'Pure Storage', 'Waymo', 'Grammarly', 'Flipkart', 'Phonepe',
        'DE Shaw', 'Citadel', 'Jane Street', 'TWO Sigma', 'Optiver', 'SIG', 'Akuna Capital', 'Squarepoint Capital', 'Millennium', 'Graviton',
      ] },
      { id: 'tier2', label: 'Tier 2', companies: [
        'Cisco', 'Qualcomm', 'Intel', 'AMD', 'Samsung', 'SAP', 'Ebay', 'Expedia', 'Yahoo', 'Autodesk', 'Docusign', 'Sprinklr',
        'Zoho', 'Paypal', 'Visa', 'Mastercard', 'Yandex', 'WIX', 'Agoda', 'Coupang', 'Epic Systems', 'Mathworks', 'Medianet',
        'Splunk', 'Akamai', 'Netapp', 'Microstrategy', 'Vimeo', 'Tripadvisor', 'Twilio', 'Quora', 'Hubspot', 'Cadence', 'Opentext',
        'Zenefits', 'Nokia', 'Huawei', 'Baidu', 'VK', 'Ozon', 'Avito', 'Tinkoff', 'Rakuten', 'Shopee', 'Grab', 'Careem', 'Yelp',
        'Roku', 'Criteo', 'Uipath', 'Udemy', 'Coursera', 'Instacart', 'Square', 'Chewy', 'Wayfair', 'Bookingcom', 'Liveramp',
        'Vmware', 'Zscaler', 'Netskope', 'Commvault', 'Couchbase', 'BOX', 'Toast', 'Audible', 'Deliveroo', 'Revolut', 'Affirm',
        'Sofi', 'Upstart', 'KLA', 'Texas Instruments', 'Dell', 'HTC', 'Freshworks', 'Makemytrip', 'Myntra', 'Swiggy', 'Zomato',
        'Paytm', 'Inmobi', 'Airtel', 'the Trade Desk', 'IXL', 'Arcesium', 'Mitsogo', 'Nielsen', 'Axon', 'Rivian', 'Lucid', 'UKG',
      ] },
    ],
  },
  {
    id: 'service', label: 'Service-based',
    subgroups: [
      { id: 'consulting', label: 'Foreign consulting', companies: ['Accenture', 'Capgemini', 'Cognizant', 'IBM', 'Epam Systems', 'Publicis Sapient', 'Nagarro', 'Virtusa', 'ZS Associates', 'BCG'] },
      { id: 'big4', label: 'Big 4', companies: ['Deloitte', 'PwC', 'EY', 'KPMG'] },
      { id: 'indian', label: 'Indian MNC', companies: ['TCS', 'Infosys', 'Wipro', 'HCL', 'LTI', 'Tech Mahindra', 'Persistent Systems', 'Hashedin', 'Accolite', 'Josh Technology', 'Zopsmart', 'Fractal Analytics', 'Sigmoid'] },
    ],
  },
  {
    id: 'gcc', label: 'GCC',
    subgroups: [
      { id: 'gcc-finance', label: 'Banking & finance', companies: ['Goldman Sachs', 'Morgan Stanley', 'Jpmorgan', 'Wells Fargo', 'American Express', 'Capital ONE', 'Barclays', 'Citi', 'Deutsche Bank', 'BNY Mellon', 'Hsbc', 'Blackrock', 'Geico'] },
      { id: 'gcc-consumer', label: 'Retail, health & consumer', companies: ['Nike', 'Target', 'Optum', 'Disney', 'Tesco', "Lowe's"] },
      { id: 'gcc-industrial', label: 'Auto & industrial', companies: ['Nissan Digital', 'General Motors', 'Siemens', 'LG Electronics', 'DP World', 'Mercedes-Benz'] },
      { id: 'gcc-media', label: 'Media & telecom', companies: ['Comcast', 'ATT', 'Warnermedia'] },
    ],
  },
  {
    id: 'startups', label: 'Startups',
    subgroups: [
      { id: 'startup-india', label: 'Indian startups', companies: ['Meesho', 'Zepto', 'Razorpay', 'Dream11', 'Juspay', 'Darwinbox', 'Clevertap', 'Zeta', 'Urban Company', 'OYO', 'Tekion', 'Turing'] },
      { id: 'startup-global', label: 'Global startups', companies: [
        'Anduril', 'Verkada', 'Whatnot', 'Faire', 'Quince', 'Motive', 'Applied Intuition', 'Nuro', 'Zoox', 'Aurora', 'Weride',
        'Moloco', 'Rokt', 'Bitgo', 'Attentive', 'Earnin', 'Micro1', 'Karat', 'Hive', 'Lime', 'Compass', 'Flexport', 'C3 AI',
        'Ripple', 'Verily', '6sense', 'Pocket Gems',
      ] },
    ],
  },
]

// Company name -> { group, subgroup } for quick lookups.
const INDEX = new Map()
for (const g of COMPANY_GROUPS) for (const s of g.subgroups) for (const c of s.companies) INDEX.set(c, { group: g.id, subgroup: s.id })

export const OTHER = { id: 'other', label: 'Other' }

// Rank for "best-known first" lists: FAANG, then Tier 1, Tier 2, ... in the order the groups are declared.
const RANK = new Map()
COMPANY_GROUPS.flatMap(g => g.subgroups).forEach((s, i) => s.companies.forEach(c => RANK.set(c, i)))
export function byProminence(a, b) {
  return (RANK.get(a) ?? 99) - (RANK.get(b) ?? 99)
}

export function groupOf(company) {
  return INDEX.get(company) || { group: OTHER.id, subgroup: OTHER.id }
}
