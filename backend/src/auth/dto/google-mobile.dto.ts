import { IsJWT, IsString } from 'class-validator';

/** Body for `POST /auth/google/mobile` — a Google id_token from the app. */
export class GoogleMobileDto {
  @IsString()
  @IsJWT()
  idToken!: string;
}
