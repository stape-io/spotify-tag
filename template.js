const BigQuery = require('BigQuery');
const generateRandom = require('generateRandom');
const getAllEventData = require('getAllEventData');
const getContainerVersion = require('getContainerVersion');
const getCookieValues = require('getCookieValues');
const getRequestHeader = require('getRequestHeader');
const getTimestampMillis = require('getTimestampMillis');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeInteger = require('makeInteger');
const makeNumber = require('makeNumber');
const makeString = require('makeString');
const Math = require('Math');
const Object = require('Object');
const sendHttpRequest = require('sendHttpRequest');
const setCookie = require('setCookie');
const sha256Sync = require('sha256Sync');

/*==============================================================================
==============================================================================*/

const traceId = getRequestHeader('trace-id');

const eventData = getAllEventData();

const useOptimisticScenario = isUIFieldTrue(data.useOptimisticScenario);

if (!isConsentGivenOrNotRequired(data, eventData)) {
  return data.gtmOnSuccess();
}

const url = eventData.page_location || getRequestHeader('referer');
if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
  return data.gtmOnSuccess();
}

const mappedData = mapEvent(data, eventData);

const missingFields = areThereRequiredParametersMissing(mappedData);
if (missingFields) {
  log({
    Name: 'Spotify',
    Type: 'Message',
    TraceId: traceId,
    EventName: mappedData.conversion_events.events[0].event_name,
    Message: 'Request was not sent.',
    Reason: 'One or more required parameters are missing: ' + missingFields.join(' or ')
  });

  return data.gtmOnFailure();
}

sendRequest(mappedData);

if (useOptimisticScenario) {
  return data.gtmOnSuccess();
}

/*==============================================================================
Vendor related functions
==============================================================================*/

function mapEvent(data, eventData) {
  let mappedData = {
    conversion_events: {
      capi_connection_id: data.connectionId
    }
  };

  mappedData = addServerEventData(data, eventData, mappedData);
  mappedData = addEventDetailsData(data, eventData, mappedData);
  mappedData = addUserData(data, eventData, mappedData);
  mappedData = hashDataIfNeeded(mappedData);

  return mappedData;
}

function mapEventName(data, eventData) {
  if (data.eventType === 'inherit') {
    const eventName = eventData.event_name;

    const gaToEventName = {
      page_view: 'Page_View',
      'gtm.dom': 'Page_View',
      sign_up: 'Sign_Up',
      generate_lead: 'Lead',
      view_item: 'View_Product',
      add_to_cart: 'Add_Cart',
      begin_checkout: 'Start_Checkout',
      purchase: 'Purchase'
    };

    if (gaToEventName[eventName]) {
      return gaToEventName[eventName];
    }

    return eventName;
  }

  return data.eventType === 'standard' ? data.eventNameStandard : data.eventNameCustom;
}

function addServerEventData(data, eventData, mappedData) {
  const event = {
    event_name: mapEventName(data, eventData)
  };

  const eventId = eventData.event_id || eventData.eventId;
  if (eventId) event.event_id = makeString(eventId);

  const eventTime = eventData.event_time || eventData.eventTime || eventData.timestamp;
  event.event_time = getConversionTimestamp(eventTime);

  if (data.actionSource) event.action_source = data.actionSource;

  if (isUIFieldTrue(data.optOutTargeting)) event.opt_out_targeting = true;

  if (eventData.page_location) event.event_source_url = eventData.page_location;

  if (data.serverEventDataList) {
    data.serverEventDataList.forEach((d) => {
      if (d.name === 'event_time') event[d.name] = getConversionTimestamp(d.value);
      else event[d.name] = d.value;
    });
  }

  mappedData.conversion_events.events = [event];

  return mappedData;
}

function addEventDetailsData(data, eventData, mappedData) {
  const eventDetails = {};

  if (eventData.value) eventDetails.amount = makeNumber(eventData.value);

  if (eventData.currency) eventDetails.currency = eventData.currency;

  if (data.eventDetailsParametersObject) mergeObj(eventDetails, data.eventDetailsParametersObject);
  if (data.eventDetailsParametersList) {
    data.eventDetailsParametersList.forEach((d) => (eventDetails[d.name] = d.value));
  }

  mappedData.conversion_events.events[0].event_details = eventDetails;

  return mappedData;
}

function addUserData(data, eventData, mappedData) {
  const eventDataUserData = eventData.user_data || {};

  let email =
    eventData.email ||
    eventData.email_address ||
    eventDataUserData.email ||
    eventDataUserData.email_address ||
    eventDataUserData.sha256_email_address;
  const emailType = getType(email);
  if (emailType === 'string') email = [email];
  else if (emailType === 'array') email = email.length > 0 ? email : undefined;
  else if (emailType === 'object') {
    const emailsFromObject = Object.values(email);
    if (emailsFromObject.length) email = emailsFromObject;
  }

  let phone =
    eventData.phone ||
    eventData.phone_number ||
    eventDataUserData.phone ||
    eventDataUserData.phone_number ||
    eventDataUserData.sha256_phone_number;
  const phoneType = getType(phone);
  if (phoneType === 'array') phone = phone.length > 0 ? phone[0] : undefined;
  else if (phoneType === 'object') {
    const phonesFromObject = Object.values(phone);
    if (phonesFromObject.length) phone = phonesFromObject[0];
  }

  let userData = {};

  if (email) userData.hashed_emails = email;

  if (phone) userData.hashed_phone_number = phone;

  if (eventData.ip_override) userData.ip_address = eventData.ip_override;

  if (data.userDataObject) mergeObj(userData, data.userDataObject);
  if (data.userDataParametersList) {
    data.userDataParametersList.forEach((d) => {
      if (d.name === 'hashed_emails' && getType(d.value) === 'string') {
        userData[d.name] = [d.value];
      } else userData[d.name] = d.value;
    });
  }

  if (!userData.device_id && isUIFieldTrue(data.generateDeviceIdCookie)) {
    let deviceId;

    let pixelCookieName = '__spdt';
    const pixelDeviceIdCookies = {
      __spdt: getCookieValues('__spdt')[0],
      __pdst: getCookieValues('__pdst')[0]
    };
    for (const key in pixelDeviceIdCookies) {
      if (pixelDeviceIdCookies[key]) {
        deviceId = pixelDeviceIdCookies[key];
        pixelCookieName = key;
        break;
      }
    }

    if (!deviceId) deviceId = generateDeviceId();

    userData.device_id = deviceId;

    const cookieOptions = {
      domain: data.deviceIdCookieDomain || 'auto',
      samesite: 'Lax',
      path: '/',
      secure: true,
      httpOnly: !!data.deviceIdCookieHttpOnly,
      'max-age': 60 * 60 * 24 * (makeInteger(data.deviceIdCookieExpiration) || 365)
    };
    setCookie(pixelCookieName, deviceId, cookieOptions);
  }

  userData = normalizeUserData(userData);

  mappedData.conversion_events.events[0].user_data = userData;

  return mappedData;
}

function normalizeUserData(userData) {
  if (userData.hashed_phone_number)
    userData.hashed_phone_number = normalizePhoneNumber(userData.hashed_phone_number);

  return userData;
}

function hashData(value) {
  if (!value) return value;

  const type = getType(value);

  if (value === 'undefined' || value === 'null') return undefined;

  if (type === 'array') {
    return value.map((val) => hashData(val));
  }

  if (type === 'object') {
    return Object.keys(value).reduce((acc, val) => {
      acc[val] = hashData(value[val]);
      return acc;
    }, {});
  }

  if (isHashed(value)) return value;

  return sha256Sync(makeString(value).trim().toLowerCase(), {
    outputEncoding: 'hex'
  });
}

function hashDataIfNeeded(mappedData) {
  const userDataKeysToHash = ['hashed_emails', 'hashed_phone_number'];
  const userData = mappedData.conversion_events.events[0].user_data;
  if (userData) {
    userDataKeysToHash.forEach((key) => (userData[key] = hashData(userData[key])));
  }

  return mappedData;
}

function getConversionTimestamp(timestamp) {
  if (!timestamp) return convertTimestampToISO(getTimestampMillis());

  let timestampInt = makeInteger(timestamp);
  if (timestampInt && getType(timestampInt) === 'number') {
    const timestampString = makeString(timestamp);
    // This will be false only in 2286, when timestamps in seconds starts to have 11 digits.
    timestampInt = timestampString.length === 10 ? timestamp * 1000 : timestamp;
    return convertTimestampToISO(timestampInt);
  }

  return timestamp;
}

function areThereRequiredParametersMissing(mappedData) {
  const requiredCommonParameters = ['event_name', 'event_time'];
  const event = mappedData.conversion_events.events[0];
  const commonParametersMissing = requiredCommonParameters.some((p) => !isValidValue(event[p]));
  if (commonParametersMissing) return requiredCommonParameters;

  const requiredUserDataParameters = [
    'ip_address',
    'device_id',
    'hashed_emails',
    'hashed_phone_number'
  ];
  const userData = event.user_data;
  const userDataParametersMissing = requiredUserDataParameters.every((p) => {
    if (!isValidValue(userData[p])) return true;
    if (p === 'hashed_emails') {
      return mappedData[p].every((email) => !isValidValue(userData[p][email]));
    }
    return false;
  });
  if (userDataParametersMissing) return requiredUserDataParameters;
}

function getRequestBaseUrl() {
  return 'https://capi.spotify.com/capi-direct/events/';
}

function generateRequestHeaders() {
  return {
    Authorization: 'Bearer ' + data.authToken,
    'Content-Type': 'application/json'
  };
}

function sendRequest(mappedData) {
  const requestUrl = getRequestBaseUrl();

  log({
    Name: 'Spotify',
    Type: 'Request',
    TraceId: traceId,
    EventName: mappedData.conversion_events.events[0].event_name,
    RequestMethod: 'POST',
    RequestUrl: requestUrl,
    RequestBody: mappedData
  });

  return sendHttpRequest(
    requestUrl,
    (statusCode, headers, body) => {
      log({
        Name: 'Spotify',
        Type: 'Response',
        TraceId: traceId,
        EventName: mappedData.conversion_events.events[0].event_name,
        ResponseStatusCode: statusCode,
        ResponseHeaders: headers,
        ResponseBody: body
      });

      if (!useOptimisticScenario) {
        if (statusCode >= 200 && statusCode < 300) {
          data.gtmOnSuccess();
        } else {
          data.gtmOnFailure();
        }
      }
    },
    {
      headers: generateRequestHeaders(),
      method: 'POST'
    },
    JSON.stringify(mappedData)
  );
}

/*==============================================================================
Helpers
==============================================================================*/

function isHashed(value) {
  if (!value) return false;
  return makeString(value).match('^[A-Fa-f0-9]{64}$') !== null;
}

function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return phoneNumber;
  return phoneNumber
    .split(' ')
    .join('')
    .split('-')
    .join('')
    .split('(')
    .join('')
    .split(')')
    .join('');
}

function random() {
  return generateRandom(1000000000000000, 10000000000000000) / 10000000000000000;
}

function generateDeviceId() {
  function s(n) {
    return h((random() * (1 << (n << 2))) ^ getTimestampMillis()).slice(-n);
  }
  function h(n) {
    return (n | 0).toString(16);
  }
  return [
    s(4) + s(4),
    s(4),
    '4' + s(3),
    h(8 | (random() * 4)) + s(3),
    getTimestampMillis().toString(16).slice(-10) + s(2)
  ].join('');
}

function convertTimestampToISO(timestamp) {
  const leapYear = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const nonLeapYear = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const secToMs = (s) => s * 1000;
  const minToMs = (m) => m * secToMs(60);
  const hoursToMs = (h) => h * minToMs(60);
  const daysToMs = (d) => d * hoursToMs(24);
  const padStart = (value, length) => {
    let result = makeString(value);
    while (result.length < length) {
      result = '0' + result;
    }
    return result;
  };

  const fourYearsInMs = daysToMs(365 * 4 + 1);
  let year = 1970 + Math.floor(timestamp / fourYearsInMs) * 4;
  timestamp = timestamp % fourYearsInMs;

  while (true) {
    let isLeapYear = year % 4 === 0;
    let nextTimestamp = timestamp - daysToMs(isLeapYear ? 366 : 365);
    if (nextTimestamp < 0) {
      break;
    }
    timestamp = nextTimestamp;
    year = year + 1;
  }

  const daysByMonth = year % 4 === 0 ? leapYear : nonLeapYear;

  let month = 0;
  for (let i = 0; i < daysByMonth.length; i++) {
    const msInThisMonth = daysToMs(daysByMonth[i]);
    if (timestamp > msInThisMonth) {
      timestamp = timestamp - msInThisMonth;
    } else {
      month = i + 1;
      break;
    }
  }

  const date = Math.ceil(timestamp / daysToMs(1));
  timestamp = timestamp - daysToMs(date - 1);
  const hours = Math.floor(timestamp / hoursToMs(1));
  timestamp = timestamp - hoursToMs(hours);
  const minutes = Math.floor(timestamp / minToMs(1));
  timestamp = timestamp - minToMs(minutes);
  const sec = Math.floor(timestamp / secToMs(1));
  timestamp = timestamp - secToMs(sec);
  const milliSeconds = timestamp;

  return (
    year +
    '-' +
    padStart(month, 2) +
    '-' +
    padStart(date, 2) +
    'T' +
    padStart(hours, 2) +
    ':' +
    padStart(minutes, 2) +
    ':' +
    padStart(sec, 2) +
    '.' +
    padStart(milliSeconds, 3) +
    'Z'
  );
}

function isUIFieldTrue(field) {
  return [true, 'true'].indexOf(field) !== -1;
}

function isValidValue(value) {
  const valueType = getType(value);
  return valueType !== 'null' && valueType !== 'undefined' && value !== '';
}

function mergeObj(target, source) {
  for (const key in source) {
    if (source.hasOwnProperty(key)) target[key] = source[key];
  }
  return target;
}

function isConsentGivenOrNotRequired(data, eventData) {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function log(rawDataToLog) {
  const logDestinationsHandlers = {};
  if (determinateIsLoggingEnabled()) logDestinationsHandlers.console = logConsole;
  if (determinateIsLoggingEnabledForBigQuery()) logDestinationsHandlers.bigQuery = logToBigQuery;

  const keyMappings = {
    // No transformation for Console is needed.
    bigQuery: {
      Name: 'tag_name',
      Type: 'type',
      TraceId: 'trace_id',
      EventName: 'event_name',
      RequestMethod: 'request_method',
      RequestUrl: 'request_url',
      RequestBody: 'request_body',
      ResponseStatusCode: 'response_status_code',
      ResponseHeaders: 'response_headers',
      ResponseBody: 'response_body'
    }
  };

  for (const logDestination in logDestinationsHandlers) {
    const handler = logDestinationsHandlers[logDestination];
    if (!handler) continue;

    const mapping = keyMappings[logDestination];
    const dataToLog = mapping ? {} : rawDataToLog;

    if (mapping) {
      for (const key in rawDataToLog) {
        const mappedKey = mapping[key] || key;
        dataToLog[mappedKey] = rawDataToLog[key];
      }
    }

    handler(dataToLog);
  }
}

function logConsole(dataToLog) {
  logToConsole(JSON.stringify(dataToLog));
}

function logToBigQuery(dataToLog) {
  const connectionInfo = {
    projectId: data.logBigQueryProjectId,
    datasetId: data.logBigQueryDatasetId,
    tableId: data.logBigQueryTableId
  };

  dataToLog.timestamp = getTimestampMillis();

  ['request_body', 'response_headers', 'response_body'].forEach((p) => {
    dataToLog[p] = JSON.stringify(dataToLog[p]);
  });

  const bigquery =
    getType(BigQuery) === 'function' ? BigQuery() /* Only during Unit Tests */ : BigQuery;
  bigquery.insert(connectionInfo, [dataToLog], { ignoreUnknownValues: true });
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

function determinateIsLoggingEnabledForBigQuery() {
  if (data.bigQueryLogType === 'no') return false;
  return data.bigQueryLogType === 'always';
}
