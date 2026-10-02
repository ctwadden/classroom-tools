import service from './_shared/evidence-service.cjs';
import {getStore} from '@netlify/blobs';

export default async (request: Request) => {
  const env = service.deploymentEnv(new URL(request.url).hostname,(name: string)=>Netlify.env.get(name));
  return service.makeService({env,store:service.openStore(env,'connected-evidence',getStore),legacy:service.openStore(env,'learning-events',getStore)})(request);
};
