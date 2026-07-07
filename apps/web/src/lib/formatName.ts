const MAX_DISPLAY_NAME_LENGTH = 8;
const TRUNCATED_NAME_LENGTH = 4;

export function getDisplayFirstName(fullName: string): string {
  const firstName = fullName.trim().split(/\s+/)[0] ?? '';
  if (firstName.length <= MAX_DISPLAY_NAME_LENGTH) {
    return firstName;
  }
  return `${firstName.slice(0, TRUNCATED_NAME_LENGTH)}..`;
}
