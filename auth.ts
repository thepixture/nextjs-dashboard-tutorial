import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { sql } from '@vercel/postgres';
import type { User } from '@/app/lib/definitions';
import bcrypt from 'bcrypt';

/**
 * Fetches a user from the database by email
 * @param email The email to search for
 * @returns The user object if found, undefined otherwise
 */
async function getUser(email: string): Promise<User | undefined> {
    try {
        const user = await sql.query<User>(`SELECT * FROM users WHERE email=$1`, [email]);
        return user.rows[0];
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}

// Configure and export NextAuth authentication
export const { auth, signIn, signOut } = NextAuth({
    ...authConfig,  // Spread existing auth configuration
    providers: [
        Credentials({
            async authorize(credentials) {
                // Validate the incoming credentials using Zod schema
                const parsedCredentials = z
                    .object({ 
                        email: z.string().email(),  // Ensure valid email format
                        password: z.string().min(6)  // Minimum 6 characters
                    })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    // Fetch user from database
                    const user = await getUser(email);
                    if (!user) return null;  // User not found
                    // Compare provided password with stored hash
                    const passwordsMatch = await bcrypt.compare(password, user.password);

                    if (passwordsMatch) return user;  // Successful authentication
                }

                console.log('Invalid credentials');
                return null;  // Authentication failed
            },
        }),
    ],
});