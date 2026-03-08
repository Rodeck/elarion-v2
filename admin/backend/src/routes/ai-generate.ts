import { Router, Request, Response } from 'express';
import { getPromptById } from '../../../../backend/src/db/queries/image-prompts';
import { getConfigValue } from '../../../../backend/src/db/queries/admin-config';
import { generateImage } from '../services/image-gen';

export const aiGenerateRouter = Router();

function log(level: string, event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...extra }));
}

function resolvePlaceholders(template: string, variables: Record<string, string>): string {
  let resolved = template;
  for (const [key, value] of Object.entries(variables)) {
    resolved = resolved.split(`<${key}>`).join(value);
  }
  return resolved;
}

// POST /api/ai/generate-image
aiGenerateRouter.post('/generate-image', async (req: Request, res: Response) => {
  const { prompt_id, variables } = req.body as { prompt_id?: unknown; variables?: unknown };

  if (!prompt_id || typeof prompt_id !== 'number') {
    return res.status(400).json({ error: 'prompt_id is required and must be a number' });
  }
  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
    return res.status(400).json({ error: 'variables is required and must be an object' });
  }

  const apiKey = process.env['OPENROUTER_API_KEY'];
  if (!apiKey) {
    log('warn', 'image_gen_no_api_key', { admin: req.username });
    return res.status(503).json({ error: 'OpenRouter API key not configured' });
  }

  try {
    const prompt = await getPromptById(prompt_id);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

    const resolvedPrompt = resolvePlaceholders(prompt.body, variables as Record<string, string>);
    const model = await getConfigValue('image_gen_model');

    log('info', 'image_gen_started', { admin: req.username, prompt_id, model });

    const base64 = await generateImage(resolvedPrompt, model);

    log('info', 'image_gen_completed', { admin: req.username, prompt_id, model });
    return res.json({ base64, resolved_prompt: resolvedPrompt, model_used: model });
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes('NO_API_KEY') || errStr.includes('not configured')) {
      return res.status(503).json({ error: 'OpenRouter API key not configured' });
    }
    log('error', 'image_gen_failed', { admin: req.username, prompt_id, error: errStr });
    return res.status(502).json({ error: `Image generation failed: ${(err as Error).message}` });
  }
});
