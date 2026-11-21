import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @Matches(PASSWORD_PATTERN, {
    message: 'Password must be at least 8 characters and contain a letter and a number',
  })
  password!: string;
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;
}
