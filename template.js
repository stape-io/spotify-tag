const JSON = require('JSON');
const sendHttpRequest = require('sendHttpRequest');
const getContainerVersion = require('getContainerVersion');
const logToConsole = require('logToConsole');
const getRequestHeader = require('getRequestHeader');
const encodeUriComponent = require('encodeUriComponent');
const Object = require('Object');

const isLoggingEnabled = determinateIsLoggingEnabled();
const traceId = getRequestHeader('trace-id');

sendTrackRequest();

function sendTrackRequest() {
  let host = 'https://img.byspotify.com';
  const params = getRequestParams();
  const queryString = mapParamsToQueryString(params);
  const url = host + '?' + queryString;
  const headers = getRequestHeaders();

  if (isLoggingEnabled) {
    logToConsole(
      JSON.stringify({
        Name: 'Spotify',
        Type: 'Request',
        TraceId: traceId,
        EventName: params.a,
        RequestMethod: 'GET',
        RequestUrl: url,
        RequestHeaders: headers,
      })
    );
  }
  sendHttpRequest(
    url,
    (statusCode, headers, body) => {
      if (isLoggingEnabled) {
        logToConsole(
          JSON.stringify({
            Name: 'Spotify',
            Type: 'Response',
            TraceId: traceId,
            EventName: params.a,
            ResponseStatusCode: statusCode,
            ResponseHeaders: headers,
            ResponseBody: body,
          })
        );
      }
      if (!data.useOptimisticScenario) {
        if (statusCode >= 200 && statusCode < 400) {
          data.gtmOnSuccess();
        } else {
          data.gtmOnFailure();
        }
      }
    },
    {
      headers: headers,
    }
  );

  if (data.useOptimisticScenario) {
    data.gtmOnSuccess();
  }
}

function getRequestParams() {
  const params = {
    key: data.pixel_id,
    uid: data.session_id,
    a: data.action,
  };
  const paramMappers = {
    init: addInitParams,
    lead: addLeadParams,
    purchase: addPurchaseParams,
  };
  const paramMapper = paramMappers[params.action];
  if (paramMapper) paramMapper(params);
  return params;
}

function addInitParams(params) {
  params.alias = data.init_alias;
}

function addLeadParams(params) {
  params.type = data.lead_content_type;
  params.value = data.lead_value;
}

function addPurchaseParams(params) {
  params.currency = data.purchase_currency;
  params.value = data.purchase_value;
  params.order_id = data.purchase_order_id;
}

function getRequestHeaders() {
  return {
    'X-Forwarded-For': getRequestHeader('X-Forwarded-For'),
    UserAgent: getRequestHeader('User-Agent'),
    Referer: getRequestHeader('Referer'),
  };
}

function mapParamsToQueryString(params) {
  return Object.keys(params)
    .map((key) => key + '=' + encodeUriComponent(params[key]))
    .join('&');
}

function determinateIsLoggingEnabled() {
  const containerVersion = getContainerVersion();
  const isDebug = !!(
    containerVersion &&
    (containerVersion.debugMode || containerVersion.previewMode)
  );

  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}
