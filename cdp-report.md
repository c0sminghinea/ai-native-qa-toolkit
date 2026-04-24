# CDP Inspector Report

**URL:** https://cal.com/bailey/chat
**Date:** 2026-04-24
**Tool:** Chrome DevTools Protocol (CDP) via Playwright

---

## Network Summary
- Total requests captured: 80
- API/tRPC calls: 9
- Failed requests: 0
- JavaScript errors: 0

## API Calls Detected
- `GET` https://i.cal.com/api/auth/session [200]
- `GET` https://i.cal.com/api/avatar/174ee777-d9e1-433c-899d-43eaed1a193f.png [200]
- `GET` https://app.cal.com/api/logo [200]
- `GET` https://cal.com/api/avatar/86d637bc-bd3b-46dc-9a82-23ae74a151d2.png [200]
- `GET` https://i.cal.com/api/trpc/slots/getSchedule?input=%7B%22json%22%3A%7B%22isTeamEvent%22%3Afalse%2C%22usernameList%22%3A%5B%22bailey%22%5D%2C%22eventTypeSlug%22%3A%22chat%22%2C%22startTime%22%3A%222026-03-31T21%3A00%3A00.000Z%22%2C%22endTime%22%3A%222026-05-31T20%3A59%3A59.999Z%22%2C%22timeZone%22%3A%22Europe%2FBucharest%22%2C%22duration%22%3Anull%2C%22rescheduleUid%22%3Anull%2C%22orgSlug%22%3A%22i%22%2C%22teamMemberEmail%22%3Anull%2C%22routedTeamMemberIds%22%3Anull%2C%22skipContactOwner%22%3Afalse%2C%22routingFormResponseId%22%3Anull%2C%22email%22%3Anull%2C%22embedConnectVersion%22%3A%220%22%2C%22_isDryRun%22%3Afalse%2C%22_bookerCorrelationId%22%3A%22fd289276-8d70-45c2-9d89-ff9048f6e6c7%22%7D%2C%22meta%22%3A%7B%22values%22%3A%7B%22duration%22%3A%5B%22undefined%22%5D%2C%22teamMemberEmail%22%3A%5B%22undefined%22%5D%2C%22routingFormResponseId%22%3A%5B%22undefined%22%5D%7D%7D%7D [200]
- `GET` https://i.cal.com/api/trpc/features/map?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%7D [200]
- `GET` https://i.cal.com/api/trpc/timezones/cityTimezones?input=%7B%22json%22%3A%7B%22hash%22%3A%2258b6ead3%22%7D%7D [200]
- `GET` https://cal.com/api/avatar/86d637bc-bd3b-46dc-9a82-23ae74a151d2.png [pending]
- `POST` https://o574544.ingest.us.sentry.io/api/4509594045513728/envelope/?sentry_version=7&sentry_key=7fa2ea46dede9404597bde582525baca&sentry_client=sentry.javascript.nextjs%2F10.33.0 [200]

## Errors
No errors detected

## Request Interception
- Intercepted: GET https://i.cal.com/api/auth/session
- Intercepted: GET https://i.cal.com/api/trpc/slots/getSchedule?input=%7B%22json%22%3A%7B%22isTeamE

## AI Analysis
### 1. HEALTH ASSESSMENT
Based on the provided CDP session findings, the overall browser-level health of this page is **Good**. There are no failed requests, console errors, or significant issues that would indicate a critical or warning-level health assessment. The presence of some warnings in the console messages does not seem to affect the page's functionality directly.

### 2. API RISKS
There are a few API call observations worth noting:
- **Incomplete Response**: The GET request to `https://cal.com/api/avatar/86d637bc-bd3b-46dc-9a82-23ae74a151d2.png` did not receive a response. This could indicate an issue with the server or the request itself, potentially leading to errors in displaying the avatar image.
- **Potential for Abuse**: The use of tRPC and the structure of some API calls (e.g., `GET https://i.cal.com/api/trpc/slots/getSchedule`) could potentially be exploited if not properly validated and sanitized on the server side. However, without more context, it's difficult to assess the actual risk.
- **Sentry POST Request**: The page is sending a POST request to Sentry, which is a monitoring and error tracking service. This is a common practice for monitoring application performance and errors but could be a concern if the data being sent includes sensitive user information.

### 3. ERROR ANALYSIS
There are no console **errors** reported in the session findings. However, there are several **warnings** and **logs**:
- The warning about importing `markdownToSafeHTML` on the client side suggests a potential security or performance issue that should be addressed.
- The deprecation warning about using `createWithEqualityFn` instead of `create` or `useStoreWithEqualityFn` instead of `useStore` from `zustand/traditional` indicates that the application is using outdated methods, which could lead to compatibility issues or unexpected behavior in the future.
- The logs about `QuickAvailabilityCheck` feature being enabled or disabled do not seem to indicate any issues but could be part of the application's functionality.

### 4. QA RECOMMENDATIONS
Based on the observations:
1. **Test Avatar Display**: Given the missing response for one of the avatar GET requests, it's essential to verify that the avatars are properly displayed across different scenarios (e.g., user profiles, chat windows).
2. **Validate API Responses**: Specifically for the `getSchedule` tRPC call, validate that the API responds correctly with different input parameters and that the application handles these responses as expected.
3. **Monitor Sentry and Error Tracking**: While not directly related to the page's functionality, ensure that the data sent to Sentry does not include sensitive information and that error tracking is properly configured to enhance the application's overall reliability and user experience.

---
*Generated by AI-Native QA Toolkit — CDP Inspector*
