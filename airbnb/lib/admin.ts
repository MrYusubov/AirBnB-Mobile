import { useUser } from '@clerk/clerk-expo';

export const ADMIN_EMAIL = 'yhumbet05@gmail.com';

const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() ?? '';

export const isAdminEmail = (email?: string | null) =>
  normalizeEmail(email) === normalizeEmail(ADMIN_EMAIL);

export const useIsAdmin = () => {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

  return {
    email,
    isAdmin: isAdminEmail(email),
  };
};
