import service from './_shared/evidence-service.cjs';
import {getStore} from '@netlify/blobs';
// Preserve the existing Google URL while using the same validated evidence store.
export default async (request: Request) => {
  const url=new URL(request.url);url.searchParams.set('action','events');
  const env=service.deploymentEnv(url.hostname,(name: string)=>Netlify.env.get(name));
  return service.makeService({env,store:service.openStore(env,'connected-evidence',getStore),legacy:service.openStore(env,'learning-events',getStore)})(new Request(url,request));
};
