// app/api/github/app_repos/route.ts

import { NextRequest } from 'next/server';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';

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

    console.log(`[DEBUG] Installation ID: ${installationId}`);

    // Fetch all repositories with pagination using iterator
    const allRepositories = [];

    for await (const response of octokit.paginate.iterator(
      octokit.rest.apps.listReposAccessibleToInstallation,
      { per_page: 500 },
    )) {
      console.log(`[DEBUG] Fetched ${response.data.length} repositories in this page`);
      allRepositories.push(...response.data);
    }

    console.log(`[DEBUG] Total repositories fetched: ${allRepositories.length}`);

    return new Response(
      JSON.stringify({
        repositories: allRepositories,
        total_count: allRepositories.length,
      }),
      {
        status: 200,
      },
    );
  } catch (error: unknown) {
    console.error('[GITHUB ERROR]', error);

    const message = error instanceof Error ? error.message : 'Internal Server Error';

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
    });
  }
}
