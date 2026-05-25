export const CS_LIST = [
  {
    id: "dina",
    nama: "Dina",
    wa: "628816172692",
    email: "dinastroong28@gmail.com",
  },
  {
    id: "erlin",
    nama: "Erlin",
    wa: "628819984338",
    email: "erlinrsyna@gmail.com",
  },
  {
    id: "linda",
    nama: "Linda",
    wa: "6288293619376",
    email: "cslinda145@gmail.com",
  },
];

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function findCsById(csId) {
  return CS_LIST.find((cs) => cs.id === csId) || null;
}

export function findCsByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return CS_LIST.find((cs) => normalizeEmail(cs.email) === normalizedEmail) || null;
}
