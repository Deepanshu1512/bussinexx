import { Router } from 'express';
import { businessBrain } from '../services/businessBrain.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';

const router = Router();
router.use(authenticateToken);

// GET all conversations
router.get('/conversations', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const list = await businessBrain.getConversations(businessId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET messages for a conversation
router.get('/conversations/:id', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const messages = await businessBrain.getConversationMessages(businessId, req.params.id);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE conversation
router.delete('/conversations/:id', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    await businessBrain.deleteConversation(businessId, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST query Business Brain AI
router.post('/query', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { conversationId, prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const result = await businessBrain.processQuery(businessId, conversationId || null, prompt.trim());
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET raw verified business context snapshot
router.get('/context', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const context = await businessBrain.gatherBusinessContext(businessId);
    res.json(context);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
