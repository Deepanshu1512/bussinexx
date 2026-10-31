import { Router } from 'express';
import { businessBrain } from '../services/businessBrain.ts';

const router = Router();

// GET all conversations
router.get('/conversations', (req, res) => {
  try {
    const list = businessBrain.getConversations();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET messages for a conversation
router.get('/conversations/:id', (req, res) => {
  try {
    const messages = businessBrain.getConversationMessages(req.params.id);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE conversation
router.delete('/conversations/:id', (req, res) => {
  try {
    businessBrain.deleteConversation(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST query Business Brain AI
router.post('/query', async (req, res) => {
  try {
    const { conversationId, prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const result = await businessBrain.processQuery(conversationId || null, prompt.trim());
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET raw verified business context snapshot
router.get('/context', (req, res) => {
  try {
    const context = businessBrain.gatherBusinessContext();
    res.json(context);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
