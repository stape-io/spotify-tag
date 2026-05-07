# Spotify Conversions API Tag for Google Tag Manager Server-Side

The **Spotify Conversions API Tag** allows you to send web and app events from your server container to Spotify Ads using the [Spotify Conversions API](https://adshelp.spotify.com/s/article/Spotify-Conversions-API-US?language=en_US). This tag supports event deduplication, user identification, rich event details, consent handling, and automatic device ID generation when needed.

> ⚠️ **Note**: As of May 2025, the Spotify Conversions API is in **beta**. This means the API is still under active development, and changes from Spotify's side may lead to **unexpected behavior** or **breaking changes**. We recommend testing thoroughly and monitoring your implementation regularly. This tag template may also be updated in response to upstream changes.

## How to Use

1. Add the **Spotify Conversions API Tag** to your server container using the GTM Template Gallery or by importing the `template.tpl` file.
2. Provide the **Authentication Token** and **Connection ID** from your Spotify Ads Manager (required).
3. Choose the **Event Name Setup Method**:
   - **Standard**: select one of Spotify’s predefined events (e.g., `Page View`, `Purchase`).
   - **Inherit from client**: map events from the client-side automatically (e.g., `page_view` → `Page_View`).
   - **Custom**: select a custom event name. Ads Manager supports up to 5 custom events.
4. Configure optional **Event Details Parameters** (e.g., `Value`, `Currency`, `Content Name`).
5. Add **User Data Parameters** like `email`, `phone`, `IP address`, and `device ID`. Emails and phone numbers will be hashed automatically if not already hashed.
6. (Optional) Enable automatic **Device ID cookie generation** to persist identifiers across sessions.
7. (Optional) Enable **Consent Settings** to only send data if marketing consent is granted.
8. (Optional) Configure **Logging Settings** to monitor request/response data in the console or BigQuery.

## Required Fields

- **Authentication Token** – Your Spotify Conversions API access token.
- **Connection ID** – Spotify Ads connection ID for your data source.
- **Event Name** – The name of the event, either standard, inherited, or custom.
- **At least one user identifier** – One or more of the following:
  - `ip_address`
  - `device_id`
  - `hashed_emails`
  - `hashed_phone_number`

## Features

- **Event name mapping**: Map GA4-style names to Spotify’s standard event names automatically.
- **User data enrichment**: Merge user data from cookies, event fields, or UI input.
- **Automatic hashing**: Emails and phone numbers are SHA256-hashed if needed.
- **Device ID cookie generation**: Automatically generates and stores `__spdt` or `__pdst` cookies.
- **Custom parameters**: Add custom server event or event details parameters.
- **Consent control**: Only send events if marketing consent is given (if enabled).
- **Optimistic scenario**: Improve tag performance by skipping API response checks.
- **Logging**: Log data to the browser console or BigQuery for debugging and monitoring.

## Supported Standard Events

- Page View
- Sign Up
- Lead
- View Product
- Add to Cart
- Start Checkout
- Purchase
- Alias

## Useful Resources:

- [Step-by-step guide on how to configure Spotify Conversions API Tag](https://stape.io/helpdesk/documentation/spotify-tag)

## Open Source

The **Spotify Conversions API Tag for Google Tag Manager Server-Side** is developed and maintained by the [Stape Team](https://stape.io/) under the Apache 2.0 license.

### GTM Gallery Status
🟢 [Listed](https://tagmanager.google.com/gallery/#/owners/stape-io/templates/spotify-tag)
