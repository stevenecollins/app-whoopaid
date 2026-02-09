import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import { hashPassword, comparePassword } from '../utils/password.js';
import { createToken } from '../utils/jwt.js';
import { isValidEmail, isValidPassword } from '../utils/validation.js';

const router = Router();
const prisma = new PrismaClient();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/register
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, householdName } = req.body;

    if (!email || !password || !firstName || !lastName || !householdName) {
      res.status(400).json({ error: 'All fields are required: email, password, firstName, lastName, householdName' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }

    if (!isValidPassword(password)) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const household = await tx.household.create({
        data: {
          name: householdName.trim(),
          monthlyExtraBudget: 0,
          payoffStrategy: 'avalanche',
        },
      });

      const user = await tx.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role: 'owner',
          householdId: household.id,
        },
      });

      return { household, user };
    });

    const token = createToken({
      userId: result.user.id,
      householdId: result.household.id,
      email: result.user.email,
    });

    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      },
      household: {
        id: result.household.id,
        name: result.household.name,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { household: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = createToken({
      userId: user.id,
      householdId: user.householdId,
      email: user.email,
    });

    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      household: {
        id: user.household.id,
        name: user.household.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/invite/accept
router.post('/invite/accept', authLimiter, async (req: Request, res: Response) => {
  try {
    const { token: inviteToken, email, password, firstName, lastName } = req.body;

    if (!inviteToken || !email || !password || !firstName || !lastName) {
      res.status(400).json({ error: 'All fields are required: token, email, password, firstName, lastName' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }

    if (!isValidPassword(password)) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const invite = await prisma.householdInvite.findUnique({
      where: { token: inviteToken },
      include: { household: true },
    });

    if (!invite) {
      res.status(404).json({ error: 'Invalid invite token' });
      return;
    }

    if (invite.status !== 'pending') {
      res.status(400).json({ error: 'Invite has already been used or expired' });
      return;
    }

    if (new Date() > invite.expiresAt) {
      await prisma.householdInvite.update({
        where: { id: invite.id },
        data: { status: 'expired' },
      });
      res.status(400).json({ error: 'Invite has expired' });
      return;
    }

    if (invite.email.toLowerCase() !== cleanEmail) {
      res.status(403).json({ error: 'Email does not match invite' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await hashPassword(password);

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role: 'member',
          householdId: invite.householdId,
        },
      });

      await tx.householdInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted' },
      });

      return user;
    });

    const jwtToken = createToken({
      userId: newUser.id,
      householdId: invite.householdId,
      email: newUser.email,
    });

    res.cookie('token', jwtToken, COOKIE_OPTIONS);
    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
      },
      household: {
        id: invite.household.id,
        name: invite.household.name,
      },
    });
  } catch (error) {
    console.error('Invite accept error:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

export default router;
