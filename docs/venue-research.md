# Venue Research Notes

Read-only feasibility notes for candidate venues. Do not automate login, checkout, payment, booking, cart, CAPTCHA, or waiver flows.

## Sydney Racquet Club

- Status: implemented as `sydneyracquet`.
- Platform: Playtomic.
- Public club page: `https://playtomic.com/clubs/sydney-racquet-club`.
- Club positioning: mixed padel and pickleball venue. The Playtomic club page can visually default to padel courts, so keep copy and links clear that this integration reads `sport_id=PICKLEBALL`.
- Provider: `playtomic-availability`.
- Public availability endpoint used by the extension:
  `https://playtomic.com/api/clubs/availability?tenant_id=5dba6f31-06fd-4d3a-8238-1be3032bac7c&date=YYYY-MM-DD&sport_id=PICKLEBALL`
- Tenant id: `5dba6f31-06fd-4d3a-8238-1be3032bac7c`.
- Pickleball resources:
  - Pickle 3: `0badb1b1-d6c4-4c2d-bdf4-1dad54d43c68`
  - Pickle 4: `2510010b-6149-4a78-ac41-a9f4c120dc05`
  - Pickle 6: `2884798c-c79a-4af2-9b82-cdd1102b2f7e`
  - Pickle 7: `dc7300ee-7d6d-413a-8d89-a326ed8122b9`
  - Pickle 8: `a9a1064b-dc16-494e-8d8b-a9ac3df51521`

## House of Pickle DH

- Status: implemented as `houseofpickle-darlingharbour`.
- Platform: PodPlay/Podify Next.js app.
- URL: `https://houseofpickle.podplay.app/book/darling-harbour?pod=darling-harbour-pickleball-courts`.
- Guest visibility: availability is visible after the app performs Firebase anonymous guest auth.
- Plain unauthenticated API calls returned `401`; avoid manufacturing auth tokens in v1.
- Provider: `podplay-dom`.
- Safer implementation path used: content-script DOM provider that reads already-rendered session rows. Later consider a same-page API provider only if it can reuse the page's own anonymous session without creating extra identities.
- v1 limitation: reads the visible booking rows only. The provider preserves visible court labels such as `C4` when PodPlay renders them, but it does not navigate checkout, cart, login, app download, or booking flows.
- Suggested config:
  - provider id: `podplay`
  - venue id: `houseofpickle-darlingharbour`
  - tenant id: `houseofpickle`
  - area slug: `darling-harbour`
  - area id: `c8eaef5c-c83e-4ac9-84c2-d64a7d570da8`
  - pod slug: `darling-harbour-pickleball-courts`
  - pod id: `582a1846-0a56-414d-99a5-bcccc310a4e7`

## WOTSO Pickleball Pyrmont

- Status: implemented as `wotso-pyrmont`.
- Platform: Hamlet React SPA with Hasura GraphQL.
- URL: `https://wotso.hamletapp.co/shop/experience/pyrmont`.
- Guest visibility: availability appears as anonymous guest from the WOTSO origin.
- Public config: `https://wotso.hamletapp.co/env-config.js`.
- Hamlet auth/bootstrap: `https://api.hamletapp.co/v1/auth/verify`.
- GraphQL URL: `https://data.hamletapp.co/v1/graphql`.
- Plain unauthenticated GraphQL calls return a JWT/cookie error; the provider must run on the WOTSO page and reuse the page-created guest session.
- WOTSO app id: `ab9ee830-212d-4ca4-a939-f7560730ab4c`.
- Pyrmont location id: `ac2be7b5-4d0c-49b1-9840-b7d3b0832ff4`.
- Court item ids:
  - Pickleball Court 1: `7e08d719-876f-4900-98b8-257f762c91e2`
  - Pickleball Court 2: `84be6bae-2a33-43ff-99bc-70e5823a4f5c`
- Provider: `hamlet-experience`.
- Safer implementation path used: content-script provider runs from the WOTSO page, obtains the page's anonymous bootstrap, reads master/open-hours metadata and bookings, then computes open intervals from open hours minus bookings in `Australia/Sydney`.
- v1 limitation: WOTSO needs the page guest session to be ready. The extension does not create accounts, log in, add to cart, or book anything.
