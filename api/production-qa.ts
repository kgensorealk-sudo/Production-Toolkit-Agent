import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runProductionPipeline } from '../services/agents/productionPipeline.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  try {
    const { xml, cleanAction, qaInstruction } = req.body || {};

    if (typeof xml !== 'string' || !xml.trim()) {
      return res.status(400).json({
        error: 'XML input is required.',
      });
    }

    if (cleanAction !== 'accept' && cleanAction !== 'reject') {
      return res.status(400).json({
        error: 'cleanAction must be "accept" or "reject".',
      });
    }

    if (typeof qaInstruction !== 'string' || !qaInstruction.trim()) {
      return res.status(400).json({
        error: 'qaInstruction is required.',
      });
    }

    const result = await runProductionPipeline({
      xml,
      cleanAction,
      qaInstruction,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Production QA error:', error);

    return res.status(500).json({
      error: 'Production QA processing failed.',
    });
  }
}
