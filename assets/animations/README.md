# Animation assets

The animation binaries are maintained in the source repository:

https://github.com/Sihnalahiru/SSW-ReadyToFly/tree/main/assets/animations

The My-GH application loads these exact files from the source repository's raw content URLs (no duplicate binary copy is required).

| File | App usage |
|---|---|
| `Airplane arrival at airport.lottie` | Welcome / learner profile selection |
| `Passports in pink and blue.lottie` | Section transition loading |
| `Trophy.lottie` | Dashboard achievement decoration |

The app uses the dotLottie web player. These assets are external source files; browser rendering and live deployment must be checked after Cloudflare Pages publishes the latest commit.

**Profile data note:** Male 1, Male 2 and Female 1 currently use separate device-local progress stores. This is not secure authentication or cross-device synchronization. Cloudflare Worker authentication and D1 user-scoped persistence remain a separate implementation phase.
