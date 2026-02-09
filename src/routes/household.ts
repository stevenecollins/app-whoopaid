import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { requireOwner } from '../middleware/auth.js';
import { isValidEmail } from '../utils/validation.js';

const router = Router();
const prisma = new PrismaClient();

// POST /api/household/invite — owner only
router.post('/invite', requireOwner, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });
    if (existingUser) {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }

    const existingInvite = await prisma.householdInvite.findFirst({
      where: {
        email: cleanEmail,
        householdId: req.householdId!,
        status: 'pending',
      },
    });
    if (existingInvite) {
      res.status(409).json({ error: 'An invite has already been sent to this email' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');

    const invite = await prisma.householdInvite.create({
      data: {
        email: cleanEmail,
        householdId: req.householdId!,
        invitedBy: req.userId!,
        token,
        status: 'pending',
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
      },
    });

    res.status(201).json({
      message: 'Invite created successfully',
      invite: {
        id: invite.id,
        email: invite.email,
        token: invite.token,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    console.error('Invite creation error:', error);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

export default router;
