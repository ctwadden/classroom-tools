import service from './_shared/evidence-service.cjs';
import core from './_shared/evidence-core.cjs';
import {getStore} from '@netlify/blobs';
export default async (request: Request) => {
  if(request.method!=='GET')return new Response('Method not allowed',{status:405});
  const url=new URL(request.url),env=service.deploymentEnv(url.hostname,(name: string)=>Netlify.env.get(name));
  if(!['teacher','reader'].includes(service.role(request,env)))return new Response('Unauthorized',{status:401});
  const courses=url.searchParams.get('course_id')?[core.course(url.searchParams.get('course_id'))]:['MM12','COM11','IBDS'];
  const rows=[];for(const c of courses)rows.push(...await service.eventsFor(service.openStore(env,'connected-evidence',getStore),service.openStore(env,'learning-events',getStore),c));
  const events=core.applyFilters(rows,Object.fromEntries(url.searchParams));
  return Response.json({count:events.length,events},{headers:{'Cache-Control':'no-store'}});
};
