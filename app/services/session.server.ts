import { createCookie, redirect } from 'react-router';

// Create a secure cookie for the session
const sessionCookie = createCookie('mediapeek_session', {
  secrets: ['s3cr3t-k3y-replace-this-in-prod'], // In production, use env variable
  sameSite: 'lax',
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 7, // 1 week
});

export async function createUserSession(redirectTo: string) {
  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await sessionCookie.serialize('valid_session'),
    },
  });
}

export async function requireUserSession(request: Request) {
  const cookieHeader = request.headers.get('Cookie');
  const session = await sessionCookie.parse(cookieHeader);

  if (!session) {
    throw redirect('/login');
  }

  return session;
}

export async function logout() {
  return redirect('/login', {
    headers: {
      'Set-Cookie': await sessionCookie.serialize('', {
        maxAge: 0,
      }),
    },
  });
}
