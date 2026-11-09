'use strict';
window.LJOV_CONFIG={collectPartial:true,checkpointEndpoint:'/api/checkpoint',statusEndpoint:'/api/status',communityAverageEndpoint:''};
// A private resume token is read from the fragment, not a request URL.
if(location.hash.startsWith('#resume=')){window.LJOV_RESUME=decodeURIComponent(location.hash.slice(8));history.replaceState(null,'',location.pathname+location.search);}
