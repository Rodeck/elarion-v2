import { Router, Request, Response } from 'express';
import {
  getAllPrompts,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from '../../../../backend/src/db/queries/image-prompts';

export const imagePromptsRouter = Router();

function log(level: string, event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...extra }));
}

// GET /api/image-prompts
imagePromptsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const prompts = await getAllPrompts();
    log('info', 'image_prompts_listed', { admin: req.username, count: prompts.length });
    return res.json(prompts);
  } catch (err) {
    log('error', 'image_prompts_list_failed', { admin: req.username, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/image-prompts/:id
imagePromptsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid prompt id' });
  try {
    const prompt = await getPromptById(id);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
    log('info', 'image_prompt_fetched', { admin: req.username, prompt_id: id });
    return res.json(prompt);
  } catch (err) {
    log('error', 'image_prompt_fetch_failed', { admin: req.username, prompt_id: id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/image-prompts
imagePromptsRouter.post('/', async (req: Request, res: Response) => {
  const { name, body } = req.body as Record<string, unknown>;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required and must be a non-empty string' });
  }
  if (name.trim().length > 128) {
    return res.status(400).json({ error: 'name must be 128 characters or fewer' });
  }
  if (!body || typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ error: 'body is required and must be a non-empty string' });
  }
  try {
    const prompt = await createPrompt({ name: name.trim(), body: body.trim() });
    log('info', 'image_prompt_created', { admin: req.username, prompt_id: prompt.id, name: prompt.name });
    return res.status(201).json(prompt);
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes('unique') || errStr.includes('duplicate')) {
      return res.status(409).json({ error: 'Prompt name already exists' });
    }
    log('error', 'image_prompt_create_failed', { admin: req.username, error: errStr });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/image-prompts/:id
imagePromptsRouter.put('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid prompt id' });
  const { name, body } = req.body as Record<string, unknown>;
  const data: { name?: string; body?: string } = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name must be a non-empty string' });
    if (name.trim().length > 128) return res.status(400).json({ error: 'name must be 128 characters or fewer' });
    data.name = name.trim();
  }
  if (body !== undefined) {
    if (typeof body !== 'string' || !body.trim()) return res.status(400).json({ error: 'body must be a non-empty string' });
    data.body = body.trim();
  }
  try {
    const prompt = await updatePrompt(id, data);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
    log('info', 'image_prompt_updated', { admin: req.username, prompt_id: id, fields: Object.keys(data) });
    return res.json(prompt);
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes('unique') || errStr.includes('duplicate')) {
      return res.status(409).json({ error: 'Prompt name already exists' });
    }
    log('error', 'image_prompt_update_failed', { admin: req.username, prompt_id: id, error: errStr });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/image-prompts/:id
imagePromptsRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid prompt id' });
  try {
    const deleted = await deletePrompt(id);
    if (!deleted) return res.status(404).json({ error: 'Prompt not found' });
    log('info', 'image_prompt_deleted', { admin: req.username, prompt_id: id });
    return res.status(204).send();
  } catch (err) {
    log('error', 'image_prompt_delete_failed', { admin: req.username, prompt_id: id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
