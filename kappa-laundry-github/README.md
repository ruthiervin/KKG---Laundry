# Kappa House laundry

Mobile-friendly GitHub Pages website: Chapter Room and Bum, each with three washers and three dryers. QR links select the machine automatically. Visitors can search and select their name from the resident roster and cycle duration, see who is using each machine, and mark their own machine empty. The machine statuses are Empty, In use, and Done. Done means the expected time has elapsed; laundry may still be inside. Countdown and cycle progress update every second. Shared state is fetched every 10 seconds once connected.

## Publish on GitHub Pages

1. Upload the contents of this folder (not the enclosing folder) to the root of `ruthiervin/KKG---Laundry` on `main`.
2. In repository **Settings → Pages**, choose **Deploy from a branch**, `main`, `/ (root)`, and Save.
3. Wait for GitHub's Pages deployment to complete. Use the URL GitHub reports. Expected project URL: `https://ruthiervin.github.io/KKG---Laundry/`.

No build or package installation is needed. Without database configuration, the site explicitly runs in preview mode. Preview changes are stored only in the current browser. They do not update anyone else's device.

## Connect Supabase

1. Create a Supabase project.
2. Run `supabase/setup.sql` once in its SQL Editor. This creates and seeds the 12 machines, enables Row Level Security, revokes direct writes, and exposes two controlled operations.
3. Enable **Anonymous Sign-Ins** in Supabase Authentication settings. The browser receives a unique anonymous identity without asking members to make accounts.
4. Add approved resident names and phone numbers to the `residents` table through the Supabase dashboard. The app searches this roster. Missing phone numbers show “Phone number not added.”
5. Put your project URL and **publishable key** in `config.js`. Never upload a secret or service-role key.
6. Upload the updated configuration. Test from two different browsers: starting the same machine should succeed in only one, and only that browser should be able to empty it. Status refreshes every 10 seconds.

This initial model allows anyone who can visit the website to establish an anonymous session and see displayed names. It does not verify house membership. Do not import real resident phone numbers into this initial access model until you have decided who should be allowed to see the roster. Repository files should never contain real roster/contact data. Selecting a name is not identity verification. The contact button copies a stored phone number to the clipboard; it never sends a message. If access must be restricted to residents, add invite-only sign-in and membership policies before sharing real member information. An anonymous session cannot be recovered on another device or after clearing browser storage; an administrator can reset a stale machine through the Supabase table editor. Hardware is not connected; all usage is self-reported.

## Machine QR links

Open a machine and select **Copy machine QR link**. Encode that URL in a QR code and label the sticker with the room and machine name. For example:

`https://ruthiervin.github.io/KKG---Laundry/?machine=R1-W1`

Machine IDs are `R1-W1` through `R1-W3`, `R1-D1` through `R1-D3`, and the equivalent `R2` IDs. Test each printed code on a phone after deployment. Actual QR image assets have not been generated yet.

## Room reservations later

Room reservations are not implemented. Add a separate resources table and reservations table with server-enforced overlap checks, resident identity, cancellation, and house booking rules when the room names and policies are ready.

## Verification

The static files, JavaScript syntax, and 12-machine seed have been checked locally. Browser preview verified resident search, cycle start, updated availability, direct machine links, cycle finish, and clipboard copy with a fictional sample number. Live Supabase permissions and simultaneous claims have not yet been tested. Live database operations and GitHub Pages publication still need credentials/configuration and deployment. Before house use, test two simultaneous claims, ownership restrictions, all 12 QR links, expired cycles, a lost network connection, and phone layout.

If you already ran the previous roster-enabled database setup, run `supabase/add-cycle-start.sql` once to add cycle start timestamps for progress bars. New projects should run only `supabase/setup.sql`. Existing loads without a start timestamp retain their countdown but do not show percentage progress.
