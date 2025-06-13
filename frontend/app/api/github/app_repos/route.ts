// app/api/github/installations/route.ts

import { NextRequest } from 'next/server';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';
import type { Endpoints } from '@octokit/types';

type ListReposResponse =
  Endpoints['GET /installation/repositories']['response'];

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const installationId = searchParams.get('installationId');

  if (!installationId) {
    return new Response(JSON.stringify({ error: 'Missing installationId' }), {
      status: 400,
    });
  }

  try {
    const auth = createAppAuth({
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    });

    const installationAuth = await auth({
      type: 'installation',
      installationId: Number(installationId),
    });

    const octokit = new Octokit({ auth: installationAuth.token });

    const { data }: ListReposResponse =
      await octokit.rest.apps.listReposAccessibleToInstallation();

    return new Response(JSON.stringify({ repositories: data.repositories }), {
      status: 200,
    });
  } catch (error: unknown) {
    console.error('[GITHUB ERROR]', error);

    const message =
      error instanceof Error ? error.message : 'Internal Server Error';

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
    });
  }
}