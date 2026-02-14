export type Supplier = {
  id: string
  name: string
  contactName: string
  email: string
  phone: string
  address: string
  status: "Active" | "On Hold"
}

export const suppliers: Supplier[] = [
  {
    id: "SUP-ACME",
    name: "ACME Metals Ltd.",
    contactName: "Laura Chen",
    email: "laura.chen@acmemetals.com",
    phone: "+1 312 555 0177",
    address: "2400 W Industrial Pkwy, Chicago, IL 60601",
    status: "Active",
  },
  {
    id: "SUP-PACKPRO",
    name: "PackPro Solutions",
    contactName: "Daniel Wright",
    email: "daniel@packpro.io",
    phone: "+1 415 555 2234",
    address: "89 Griffith Ave, San Francisco, CA 94107",
    status: "Active",
  },
  {
    id: "SUP-FASTEN",
    name: "FastenWorks Inc.",
    contactName: "Priya Kapoor",
    email: "pkapoor@fastenworks.com",
    phone: "+1 917 555 8821",
    address: "77 Foundry Rd, Newark, NJ 07102",
    status: "On Hold",
  },
  {
    id: "SUP-LUBECO",
    name: "LubeCo Industrial",
    contactName: "Owen Smith",
    email: "orders@lubeco-industrial.com",
    phone: "+1 206 555 3910",
    address: "125 Harbor St, Seattle, WA 98101",
    status: "Active",
  },
  {
    id: "SUP-INHOUSE",
    name: "Internal Manufacturing",
    contactName: "Operations Team",
    email: "ops@sfc-g.local",
    phone: "+1 000 000 0000",
    address: "Plant 3, SFC-G Campus",
    status: "Active",
  },
  {
    id: "SUP-SAFE",
    name: "SafeGuard Supplies",
    contactName: "Maria Lopez",
    email: "maria@safe-guard.com",
    phone: "+1 832 555 9266",
    address: "401 Safety Blvd, Houston, TX 77002",
    status: "Active",
  },
]
