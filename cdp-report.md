# CDP Inspector Report

**URL:** https://cal.com/bailey/chat
**Date:** 2026-03-15
**Tool:** Chrome DevTools Protocol (CDP) via Playwright

---

## Network Summary
- Total requests captured: 77
- API/tRPC calls: 8
- Failed requests: 0
- JavaScript errors: 0

## API Calls Detected
- `GET` https://i.cal.com/api/auth/session [200]
- `GET` https://i.cal.com/api/avatar/174ee777-d9e1-433c-899d-43eaed1a193f.png [200]
- `GET` https://app.cal.com/api/logo [200]
- `GET` https://cal.com/api/avatar/86d637bc-bd3b-46dc-9a82-23ae74a151d2.png [200]
- `GET` https://i.cal.com/api/trpc/slots/getSchedule?input=%7B%22json%22%3A%7B%22isTeamEvent%22%3Afalse%2C%22usernameList%22%3A%5B%22bailey%22%5D%2C%22eventTypeSlug%22%3A%22chat%22%2C%22startTime%22%3A%222026-02-28T22%3A00%3A00.000Z%22%2C%22endTime%22%3A%222026-04-30T20%3A59%3A59.999Z%22%2C%22timeZone%22%3A%22Europe%2FBucharest%22%2C%22duration%22%3Anull%2C%22rescheduleUid%22%3Anull%2C%22orgSlug%22%3A%22i%22%2C%22teamMemberEmail%22%3Anull%2C%22routedTeamMemberIds%22%3Anull%2C%22skipContactOwner%22%3Afalse%2C%22routingFormResponseId%22%3Anull%2C%22email%22%3Anull%2C%22embedConnectVersion%22%3A%220%22%2C%22_isDryRun%22%3Afalse%7D%2C%22meta%22%3A%7B%22values%22%3A%7B%22duration%22%3A%5B%22undefined%22%5D%2C%22teamMemberEmail%22%3A%5B%22undefined%22%5D%2C%22routingFormResponseId%22%3A%5B%22undefined%22%5D%7D%7D%7D [200]
- `GET` https://i.cal.com/api/trpc/features/map?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%7D [200]
- `GET` https://i.cal.com/api/trpc/timezones/cityTimezones?input=%7B%22json%22%3A%7B%22hash%22%3A%2258b6ead3%22%7D%7D [200]
- `GET` https://cal.com/api/avatar/86d637bc-bd3b-46dc-9a82-23ae74a151d2.png [pending]

## Errors
No errors detected

## AI Analysis
### 1. HEALTH ASSESSMENT
Based on the provided CDP session findings, the overall browser-level health of this page can be classified as **Warning**. This is due to several factors:
- Despite no failed requests, there is a notable number of API and resource requests (77 total requests), which could potentially impact page load times and user experience, especially on slower networks.
- The presence of warnings in the console messages indicates potential issues or deprecated practices that could evolve into more significant problems if not addressed.
- The absence of console errors and failed requests is positive, but the warnings about deprecated functions, import practices, and configuration issues (like the need to pass an i18next instance) suggest areas needing improvement for long-term stability and performance.

### 2. API RISKS
Several concerns can be noted regarding the API calls observed:
- **Potential for Overfetching:** The number of API calls (8) and the total requests (77) is significant. While not necessarily an issue by itself, it could indicate overfetching or inefficient resource loading, potentially impacting page load times and user experience.
- **Complexity in API Parameters:** Some of the API calls, such as the `GET https://i.cal.com/api/trpc/slots/getSchedule` call, contain complex parameters. While this is not inherently a risk, it could complicate debugging and maintenance if issues arise.
- **Incomplete or Missing Responses:** The `GET https://cal.com/api/avatar/86d637bc-bd3b-46dc-9a82-23ae74a151d2.png` call is noted as having "no response." This could indicate a server-side issue or a problem with the request itself, which might affect the page's functionality or user experience.

### 3. ERROR ANALYSIS
There are **no console errors** reported in the findings. However, several warnings are present:
- **Deprecated Functions:** The use of deprecated functions (e.g., `create` instead of `createWithEqualityFn` from 'zustand/traditional') could lead to compatibility issues or unexpected behavior in future updates.
- **Import Practices:** The warning about `markdownToSafeHTML` not being imported on the client side could indicate a potential security risk if not properly handled, as it might allow for the execution of unsafe HTML.
- **Configuration Issues:** The need to pass an i18next instance for react-i18next configuration suggests that internationalization features might not be functioning as expected, potentially impacting users in different locales.

### 4. QA RECOMMENDATIONS
Based on the protocol-level observations, here are 3 specific QA recommendations:
1. **Network Throttling Tests:** Perform tests with network throttling to simulate slower internet speeds and assess how the page's load time and overall performance are affected by the high number of requests.
2. **API Call Validation:** Validate the API calls, especially those with complex parameters or those that are noted to have missing responses, to ensure they are correctly formatted, properly handled by the server, and that the responses are accurately processed by the client.
3. **Internationalization and Localization Testing:** Given the warnings about react-i18next, conduct thorough testing of the site's internationalization and localization features to ensure that they function correctly across different languages and regions, which might involve setting up test environments with various locales and languages enabled.

---
*Generated by AI-Native QA Toolkit — CDP Inspector*
