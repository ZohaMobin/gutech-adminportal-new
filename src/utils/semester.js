// Semester 0 is the pre-semester: the preparatory term before Semester 1. It is a real place in a program, so it is named,
// never shown as "no semester" or left as a bare "Semester 0".
export const semesterLabel = (n) => (Number(n) === 0 ? "Pre-semester" : `Semester ${n}`);
