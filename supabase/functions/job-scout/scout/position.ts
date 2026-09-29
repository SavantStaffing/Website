// Generated from src/lib/scout/position.ts by scripts/build-scout-function.mjs. Do not edit.
/**
 * Position type ("job family") from a posting's title and department, used to
 * cap how many postings of one kind a single company can put in the feed —
 * so 400 NVIDIA engineering roles become a handful per type and the feed has
 * room for everyone else.
 *
 * Rules run in order; the first match wins. Order matters where words
 * overlap: "Software Sales Engineer" is sales, "Accounting Manager" is
 * accounting (not management), "Data Center Technician" is IT, not data.
 */

export type PositionType =
  | "sales"
  | "customer_support"
  | "marketing"
  | "finance_accounting"
  | "legal"
  | "people_hr"
  | "admin_office"
  | "it_infrastructure"
  | "security"
  | "data_ml"
  | "software_engineering"
  | "hardware_engineering"
  | "engineering_other"
  | "product"
  | "design"
  | "science_research"
  | "healthcare"
  | "manufacturing"
  | "supply_chain"
  | "warehouse_labor"
  | "driving_delivery"
  | "skilled_trades"
  | "food_hospitality"
  | "retail"
  | "education"
  | "operations"
  | "other";

export const POSITION_LABELS: Record<PositionType, string> = {
  sales: "Sales",
  customer_support: "Customer success & support",
  marketing: "Marketing & communications",
  finance_accounting: "Finance & accounting",
  legal: "Legal & compliance",
  people_hr: "People & HR",
  admin_office: "Administrative & office",
  it_infrastructure: "IT & infrastructure",
  security: "Security",
  data_ml: "Data & machine learning",
  software_engineering: "Software engineering",
  hardware_engineering: "Hardware & silicon engineering",
  engineering_other: "Engineering (other)",
  product: "Product management",
  design: "Design",
  science_research: "Science & research",
  healthcare: "Healthcare & clinical",
  manufacturing: "Manufacturing & production",
  supply_chain: "Supply chain & procurement",
  warehouse_labor: "Warehouse & general labor",
  driving_delivery: "Driving & delivery",
  skilled_trades: "Skilled trades",
  food_hospitality: "Food service & hospitality",
  retail: "Retail",
  education: "Education",
  operations: "Operations & program management",
  other: "Other",
};

// Each pattern matches whole words; a trailing "\w*" marks a stem
// ("recruit\w*" covers recruiter, recruiting, recruitment).
const rule = (type: PositionType, words: string): [PositionType, RegExp] => [
  type,
  new RegExp(`\\b(?:${words})\\b`, "i"),
];

const RULES: [PositionType, RegExp][] = [
  // Tech titles that mention a driver or delivery aren't driving jobs.
  rule(
    "software_engineering",
    "(?:cuda|gpu|graphics|kernel|device|display|linux|windows|audio|camera|storage|network) drivers?",
  ),
  rule(
    "sales",
    "sales|account executive|account manag\\w*|key account\\w*|global account manager|gam|business development|bdr|sdr|inside (?:sales|specialist)|partner manager|partnerships?|alliances?|oem|channel manager|pre-?sales|solutions? (?:architect|consultant|specialist)|client (?:executive|partner)|commerciali[sz]ation|b2[bc]|go-to-market|gtm",
  ),
  rule(
    "customer_support",
    "customer (?:success|support|service|experience|performance)|support (?:engineer|specialist|agent|representative)|technical support|help ?desk|call center|client services",
  ),
  rule(
    "marketing",
    "marketing|brand|(?:corporate|internal|external|executive) communications|communications (?:manager|director|specialist|lead|coordinator|partner)|content|copywriter|social media|public relations|pr|growth|demand gen|seo|events? manager|media|insights|public affairs|community engagement|social impact",
  ),
  rule(
    "security",
    "security|cyber\\w*|infosec|threat|soc analyst|penetration|appsec|detection|ciso|cryptograph\\w*|trust and protection",
  ),
  rule(
    "finance_accounting",
    "accountant\\w*|accounting|accounts (?:payable|receivable)|financ\\w*|controller|tax|treasury|audit\\w*|payroll|bookkeep\\w*|billing|fp&a|actuar\\w*|risk|mergers|acquisitions|sec reporting|franchise",
  ),
  rule(
    "legal",
    "legal|counsel|attorney|paralegal|lawyer|compliance|privacy|regulatory affairs|contracts manager",
  ),
  rule(
    "people_hr",
    "recruit\\w*|talent (?:acquisition|partner)|human resources|hr|people (?:partner|operations|team|specialist)|hrbp|benefits|compensation|learning (?:and|&) development",
  ),
  rule(
    "admin_office",
    "administrative|admin(?:istrator)? assistant|executive assistant|office (?:manager|coordinator|assistant)|receptionist|front desk|clerk|data entry|scheduler|secretary",
  ),
  rule(
    "it_infrastructure",
    "it (?:support|specialist|manager|analyst|administrator|architect)|information technology|systems? administrator|sysadmin|network (?:engineer|administrator|deployment)|devops|site reliability|sre|infrastructure|cloud engineer|data ?center|desktop support|business systems analyst|sap|oracle|erp",
  ),
  rule(
    "data_ml",
    "data (?:scientist|science|engineer|analyst|analytics)|machine learning|ml|ai|genai|deep learning|analytics|business intelligence|bi|statistician|llm|computer vision|research scientist|predictive",
  ),
  rule(
    "product",
    "product (?:manager|management|owner|lead|director|architect)|technical program manag\\w*|tpm",
  ),
  rule(
    "design",
    "designer|design (?:lead|manager|director)|experience design|ux|ui|user experience|user research|creative director|illustrator|motion|artist|producer",
  ),
  rule(
    "hardware_engineering",
    "hardware|asic|fpga|silicon|chip|soc|rtl|verification engineer|physical design|analog|mixed[- ]signal|circuit|layout engineer|pcb|firmware|embedded|electrical engineer|semiconductor|photonics|signal integrity|dft|post-silicon|validation engineer|gpu|hbm|dram|nand|memory|isp|power (?:and|&) thermal|thermal|bring[- ]?up|etch|lithograph\\w*|euv|cmos|process integration|advanced packaging|yield\\w*|device integration",
  ),
  rule(
    "software_engineering",
    "software|developer|programmer|full[- ]?stack|front[- ]?end|back[- ]?end|mobile engineer|ios|android|web engineer|platform engineer|engineer(?:ing)? manager|member of technical staff|swe|application engineer|qa engineer|test engineer|automation engineer|tech lead",
  ),
  rule(
    "science_research",
    "scientist|research(?:er)?|biolog\\w*|chemist\\w*|laborator\\w*|lab tech|clinical research|bioinformatic\\w*|physicist|postdoc|quantum",
  ),
  rule(
    "healthcare",
    "nurse|rn|lvn|physician|medical|clinical|therapist|pharmac\\w*|caregiver|dental|patient|behavior technician|rbt|bcba|slp|occupational therap\\w*|physical therap\\w*",
  ),
  rule(
    "engineering_other",
    "engineer|engineering|architect|architecture|mechanical|civil|process engineer|manufacturing engineer|quality engineer|reliability|dmts|smts|mts",
  ),
  rule(
    "supply_chain",
    "supply chain|procurement|purchasing|buyer|sourcing|logistics|planner|inventory|materials manager|demand planning|order management|supplier|category (?:supply|supplier) management",
  ),
  rule(
    "manufacturing",
    "manufacturing|production|assembl\\w*|machine operator|machinist|fabricat\\w*|technician|operator|quality (?:inspector|control)|cnc|fab|process tech",
  ),
  rule(
    "warehouse_labor",
    "warehouse|picker|packer|forklift|material handler|general labor|laborer|loader|shipping|receiving|stocker|mover|janitor|custodian|cleaner|event (?:staff|setup)",
  ),
  rule(
    "driving_delivery",
    "delivery (?:driver|associate|person|courier|helper)|drivers?|courier|cdl|chauffeur|dispatcher",
  ),
  rule(
    "skilled_trades",
    "electrician|plumber|hvac|carpenter|welder|mechanic|installer|construction|foreman|superintendent|painter|roofer|drywall|maintenance technician|field service",
  ),
  rule(
    "food_hospitality",
    "cook|chef|dishwasher|server|bartender|barista|host(?:ess)?|food|kitchen|concession\\w*|catering|housekeep\\w*|hospitality|culinary",
  ),
  rule(
    "retail",
    "retail (?:associate|store|sales)|cashier|store (?:manager|associate)|sales associate|merchandis\\w*",
  ),
  rule(
    "education",
    "teacher|tutor|instructor|educator|professor|teaching|paraeducator|school|education",
  ),
  rule(
    "operations",
    "operations|program manager|project manager|chief of staff|strategy|strategist|business analyst|business analysis|consultant|coordinator|transformation|manager|director|vice president|vp",
  ),
];

export function positionType(title: string, department?: string | null): PositionType {
  for (const [type, rx] of RULES) if (rx.test(title)) return type;
  // The department settles titles that don't say ("Associate", "Lead II").
  if (department) for (const [type, rx] of RULES) if (rx.test(department)) return type;
  return "other";
}
