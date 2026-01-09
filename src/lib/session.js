import { getIronSession } from 'iron-session';

const sessionOptions = {
    password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_for_security',
    cookieName: 'quant-forum-session',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
    }
};

export async function getSession(req, res) {
    const session = await getIronSession(req, res, sessionOptions);
    return session;
}

export async function getSessionFromCookies(cookies) {
    return await getIronSession(cookies, sessionOptions);
}
