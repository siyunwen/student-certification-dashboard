
// Hard-coded exclusion list for students that should never be eligible
export const EXCLUDED_STUDENTS = [
  'david.mpinzile@gmail.com',
  'mpinzile@teksafari.org',
  'david@teksafari.org',
  'davidmpinzile@gmail.com',
  'david.mpinzile',
  'mpinzile'
];

export const isExcludedStudent = (email: string, firstName?: string, lastName?: string): boolean => {
  const lowerEmail = email.toLowerCase();
  
  // Check direct email match
  if (EXCLUDED_STUDENTS.some(excluded => lowerEmail.includes(excluded))) {
    console.log(`⚠️ EXCLUDED STUDENT FOUND BY EMAIL: ${email}`);
    return true;
  }
  
  // Check name match if available
  if (firstName && lastName) {
    const fullName = `${firstName.toLowerCase()} ${lastName.toLowerCase()}`;
    if (fullName.includes('david') && fullName.includes('mpinzile')) {
      console.log(`⚠️ EXCLUDED STUDENT FOUND BY NAME: ${fullName}`);
      return true;
    }
  }
  
  return false;
};
