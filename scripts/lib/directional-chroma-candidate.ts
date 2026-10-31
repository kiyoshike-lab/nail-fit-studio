// OFFLINE ONLY: second frozen candidate. Never imported by the application.
import {refineDirectional} from './directional-fit-candidate';
export const refineNailsFromPixels=(...args:Parameters<typeof refineDirectional>)=>refineDirectional(args[0],args[1],args[2],true);
