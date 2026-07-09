import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import { useWarmUpBrowser } from '@/hooks/useWarmUpBrowser';
import { useOAuth, useSignIn, useSignUp } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

enum Strategy {
  Google = 'oauth_google',
  Apple = 'oauth_apple',
  Facebook = 'oauth_facebook',
}

type AuthMode = 'login' | 'signup' | 'verify' | 'forgot' | 'forgotCode' | 'forgotNewPassword';

type ResetPasswordEmailCode = {
  sendCode?: () => Promise<{ error?: unknown } | void>;
  verifyCode?: (params: { code: string }) => Promise<{ error?: unknown } | void>;
  submitPassword?: (params: {
    password: string;
    signOutOfOtherSessions?: boolean;
  }) => Promise<{ error?: unknown } | void>;
};

type ResetSignInResource = {
  status?: string;
  createdSessionId?: string | null;
  resetPasswordEmailCode?: ResetPasswordEmailCode;
  create: (params: Record<string, unknown>) => Promise<ResetSignInResource>;
  attemptFirstFactor?: (params: Record<string, unknown>) => Promise<ResetSignInResource>;
};

type PasswordRule = {
  label: string;
  isValid: boolean;
};

const getPasswordRules = (value: string): PasswordRule[] => [
  { label: 'Minimum 6 characters', isValid: value.length >= 6 },
  { label: 'At least 1 uppercase letter', isValid: /[A-Z]/.test(value) },
  { label: 'At least 1 number', isValid: /\d/.test(value) },
  { label: 'At least 1 symbol', isValid: /[^A-Za-z0-9]/.test(value) },
];

const getErrorMessage = (error: unknown) => {
  const clerkError = error as { errors?: { message?: string }[]; message?: string };
  return clerkError.errors?.[0]?.message ?? clerkError.message ?? 'Please try again.';
};

const Login = () => {
  useWarmUpBrowser();

  const router = useRouter();
  const { startOAuthFlow: googleAuth } = useOAuth({ strategy: Strategy.Google });
  const { startOAuthFlow: appleAuth } = useOAuth({ strategy: Strategy.Apple });
  const { startOAuthFlow: facebookAuth } = useOAuth({ strategy: Strategy.Facebook });
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();

  const [mode, setMode] = useState<AuthMode>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetSignInAttempt, setResetSignInAttempt] = useState<ResetSignInResource | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const passwordRules = useMemo(
    () => getPasswordRules(password),
    [password],
  );
  const isPasswordValid = passwordRules.every((rule) => rule.isValid);

  const resetPasswordRules = useMemo(
    () => getPasswordRules(resetPassword),
    [resetPassword],
  );
  const isResetPasswordValid = resetPasswordRules.every((rule) => rule.isValid);

  const resetSignUpFields = () => {
    setFirstName('');
    setLastName('');
    setConfirmPassword('');
    setCode('');
  };

  const resetForgotPasswordFields = () => {
    setResetCode('');
    setResetPassword('');
    setResetConfirmPassword('');
    setResetSignInAttempt(null);
  };

  const closeLogin = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  };

  const onSelectAuth = async (strategy: Strategy) => {
    const selectedAuth = {
      [Strategy.Google]: googleAuth,
      [Strategy.Apple]: appleAuth,
      [Strategy.Facebook]: facebookAuth,
    }[strategy];

    try {
      setIsLoading(true);
      const { createdSessionId, setActive } = await selectedAuth();

      if (createdSessionId) {
        await setActive?.({ session: createdSessionId });
        closeLogin();
      }
    } catch (error) {
      Alert.alert('Could not continue', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const onLogin = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      Alert.alert('Missing info', 'Please enter your email and password.');
      return;
    }

    if (!isSignInLoaded) {
      return;
    }

    try {
      setIsLoading(true);
      const completeSignIn = await signIn.create({
        identifier: trimmedEmail,
        password,
        strategy: 'password',
      });

      if (completeSignIn.status === 'complete' && completeSignIn.createdSessionId) {
        await setSignInActive({ session: completeSignIn.createdSessionId });
        closeLogin();
        return;
      }

      Alert.alert('Login not complete', 'Please finish the required verification step.');
    } catch (error) {
      Alert.alert('Could not log in', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const onStartSignUp = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !password || !confirmPassword) {
      Alert.alert('Missing info', 'Please fill first name, last name, email, password, and confirm password.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please confirm the same password.');
      return;
    }

    if (!isPasswordValid) {
      Alert.alert('Weak password', 'Please complete all password requirements.');
      return;
    }

    if (!isSignUpLoaded) {
      return;
    }

    try {
      setIsLoading(true);
      await signUp.create({
        emailAddress: trimmedEmail,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        password,
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setMode('verify');
    } catch (error) {
      Alert.alert('Could not sign up', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const onVerifyCode = async () => {
    if (!code.trim()) {
      Alert.alert('Missing code', 'Please enter the OTP code from your email.');
      return;
    }

    if (!isSignUpLoaded) {
      return;
    }

    try {
      setIsLoading(true);
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });

      if (completeSignUp.status === 'complete' && completeSignUp.createdSessionId) {
        await setSignUpActive({ session: completeSignUp.createdSessionId });
        closeLogin();
        return;
      }

      Alert.alert('Verification not complete', 'Please check your code and try again.');
    } catch (error) {
      Alert.alert('Invalid code', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const onResendCode = async () => {
    if (!isSignUpLoaded) {
      return;
    }

    try {
      setIsLoading(true);
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      Alert.alert('Code sent', 'A new OTP code was sent to your email.');
    } catch (error) {
      Alert.alert('Could not resend code', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const getResetSignIn = () => resetSignInAttempt ?? (signIn as unknown as ResetSignInResource);

  const onSendResetCode = async () => {
    const trimmedEmail = resetEmail.trim() || email.trim();

    if (!trimmedEmail) {
      Alert.alert('Missing email', 'Please enter your email address.');
      return;
    }

    if (!isSignInLoaded) {
      return;
    }

    try {
      setIsLoading(true);
      const resetSignIn = signIn as unknown as ResetSignInResource;
      const createdSignIn = await resetSignIn.create({ identifier: trimmedEmail });
      let nextSignInAttempt = createdSignIn;

      if (createdSignIn.resetPasswordEmailCode?.sendCode) {
        const result = await createdSignIn.resetPasswordEmailCode.sendCode();

        if (result && 'error' in result && result.error) {
          throw result.error;
        }
      } else {
        nextSignInAttempt = await createdSignIn.create({
          identifier: trimmedEmail,
          strategy: 'reset_password_email_code',
        });
      }

      setResetEmail(trimmedEmail);
      setResetSignInAttempt(nextSignInAttempt);
      setMode('forgotCode');
      Alert.alert('Code sent', 'We sent a password reset code to your email.');
    } catch (error) {
      Alert.alert('Could not send code', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const onVerifyResetCode = async () => {
    const trimmedCode = resetCode.trim();

    if (!trimmedCode) {
      Alert.alert('Missing code', 'Please enter the OTP code from your email.');
      return;
    }

    if (!isSignInLoaded) {
      return;
    }

    try {
      setIsLoading(true);
      const resetSignIn = getResetSignIn();

      if (resetSignIn.resetPasswordEmailCode?.verifyCode) {
        const result = await resetSignIn.resetPasswordEmailCode.verifyCode({ code: trimmedCode });

        if (result && 'error' in result && result.error) {
          throw result.error;
        }
      }

      setMode('forgotNewPassword');
    } catch (error) {
      Alert.alert('Invalid code', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitResetPassword = async () => {
    const trimmedCode = resetCode.trim();

    if (!trimmedCode) {
      Alert.alert('Missing code', 'Please enter the OTP code from your email.');
      setMode('forgotCode');
      return;
    }

    if (!resetPassword || !resetConfirmPassword) {
      Alert.alert('Missing password', 'Please enter and confirm your new password.');
      return;
    }

    if (resetPassword !== resetConfirmPassword) {
      Alert.alert('Passwords do not match', 'Please confirm the same password.');
      return;
    }

    if (!isResetPasswordValid) {
      Alert.alert('Weak password', 'Please complete all password requirements.');
      return;
    }

    if (!isSignInLoaded) {
      return;
    }

    try {
      setIsLoading(true);
      const resetSignIn = getResetSignIn();
      let completedSignIn: ResetSignInResource | undefined;

      if (resetSignIn.resetPasswordEmailCode?.submitPassword) {
        const result = await resetSignIn.resetPasswordEmailCode.submitPassword({
          password: resetPassword,
          signOutOfOtherSessions: true,
        });

        if (result && 'error' in result && result.error) {
          throw result.error;
        }

        completedSignIn = resetSignIn;
      } else if (resetSignIn.attemptFirstFactor) {
        completedSignIn = await resetSignIn.attemptFirstFactor({
          strategy: 'reset_password_email_code',
          code: trimmedCode,
          password: resetPassword,
        });
      }

      const sessionId = completedSignIn?.createdSessionId ?? resetSignIn.createdSessionId;

      if ((completedSignIn?.status === 'complete' || resetSignIn.status === 'complete') && sessionId) {
        await setSignInActive({ session: sessionId });
        closeLogin();
        return;
      }

      Alert.alert('Password updated', 'Your password was updated. Please log in with the new password.');
      setPassword('');
      setConfirmPassword('');
      setEmail(resetEmail.trim());
      resetForgotPasswordFields();
      setMode('login');
    } catch (error) {
      Alert.alert('Could not reset password', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const switchToLogin = () => {
    setMode('login');
    resetSignUpFields();
    resetForgotPasswordFields();
  };

  const switchToSignUp = () => {
    setMode('signup');
    resetSignUpFields();
    resetForgotPasswordFields();
  };

  const switchToForgotPassword = () => {
    setResetEmail(email.trim());
    resetForgotPasswordFields();
    setMode('forgot');
  };

  const renderEmailPasswordFields = () => (
    <View style={styles.form}>
      {mode === 'signup' ? (
        <View style={styles.nameRow}>
          <View style={[styles.fieldGroup, styles.nameField]}>
            <Text style={styles.label}>First name</Text>
            <TextInput
              autoCapitalize="words"
              autoComplete="given-name"
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor="#777"
              style={[defaultStyles.inputField, styles.input]}
              textContentType="givenName"
              value={firstName}
            />
          </View>

          <View style={[styles.fieldGroup, styles.nameField]}>
            <Text style={styles.label}>Last name</Text>
            <TextInput
              autoCapitalize="words"
              autoComplete="family-name"
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor="#777"
              style={[defaultStyles.inputField, styles.input]}
              textContentType="familyName"
              value={lastName}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor="#777"
          style={[defaultStyles.inputField, styles.input]}
          textContentType="emailAddress"
          value={email}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          onChangeText={setPassword}
          placeholder="Enter password"
          placeholderTextColor="#777"
          secureTextEntry
          style={[defaultStyles.inputField, styles.input]}
          textContentType={mode === 'login' ? 'password' : 'newPassword'}
          value={password}
        />
      </View>

      {mode === 'signup' ? (
        <>
          <View style={styles.rulesCard}>
            {passwordRules.map((rule) => (
              <View key={rule.label} style={styles.ruleRow}>
                <Ionicons
                  color={rule.isValid ? '#1E9E5A' : '#999'}
                  name={rule.isValid ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                />
                <Text style={[styles.ruleText, rule.isValid && styles.ruleTextValid]}>
                  {rule.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="new-password"
              onChangeText={setConfirmPassword}
              placeholder="Repeat password"
              placeholderTextColor="#777"
              secureTextEntry
              style={[defaultStyles.inputField, styles.input]}
              textContentType="newPassword"
              value={confirmPassword}
            />
          </View>
        </>
      ) : null}
    </View>
  );

  const renderLogin = () => (
    <>
      {renderEmailPasswordFields()}
      <TouchableOpacity
        disabled={isLoading}
        onPress={onLogin}
        style={[defaultStyles.btn, styles.primaryButton, isLoading && styles.disabledButton]}>
        <Text style={defaultStyles.btnText}>{isLoading ? 'Please wait...' : 'Log In'}</Text>
      </TouchableOpacity>

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Don't have an account?</Text>
        <TouchableOpacity onPress={switchToSignUp}>
          <Text style={styles.switchLink}>Sign up</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity disabled={isLoading} onPress={switchToForgotPassword} style={styles.forgotButton}>
        <Text style={styles.switchLink}>Forgot password?</Text>
      </TouchableOpacity>
    </>
  );

  const renderSignUp = () => (
    <>
      {renderEmailPasswordFields()}
      <View nativeID="clerk-captcha" />
      <TouchableOpacity
        disabled={isLoading}
        onPress={onStartSignUp}
        style={[defaultStyles.btn, styles.primaryButton, isLoading && styles.disabledButton]}>
        <Text style={defaultStyles.btnText}>{isLoading ? 'Sending code...' : 'Sign Up'}</Text>
      </TouchableOpacity>

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Already have an account?</Text>
        <TouchableOpacity onPress={switchToLogin}>
          <Text style={styles.switchLink}>Log in</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderVerify = () => (
    <>
      <View style={styles.verifyCard}>
        <Ionicons color={Colors.primary} name="mail-outline" size={28} />
        <Text style={styles.verifyTitle}>Check your email</Text>
        <Text style={styles.verifyText}>
          We sent a one-time code to {email.trim() || 'your email address'}.
        </Text>
      </View>

      <View nativeID="clerk-captcha" />
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>OTP code</Text>
        <TextInput
          keyboardType="number-pad"
          onChangeText={setCode}
          placeholder="Enter code"
          placeholderTextColor="#777"
          style={[defaultStyles.inputField, styles.input, styles.codeInput]}
          value={code}
        />
      </View>

      <TouchableOpacity
        disabled={isLoading}
        onPress={onVerifyCode}
        style={[defaultStyles.btn, styles.primaryButton, isLoading && styles.disabledButton]}>
        <Text style={defaultStyles.btnText}>{isLoading ? 'Verifying...' : 'Verify OTP'}</Text>
      </TouchableOpacity>

      <View style={styles.verifyActions}>
        <TouchableOpacity onPress={onResendCode}>
          <Text style={styles.switchLink}>Resend code</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={switchToSignUp}>
          <Text style={styles.switchText}>Back to sign up</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderPasswordRules = (rules: PasswordRule[]) => (
    <View style={styles.rulesCard}>
      {rules.map((rule) => (
        <View key={rule.label} style={styles.ruleRow}>
          <Ionicons
            color={rule.isValid ? '#1E9E5A' : '#999'}
            name={rule.isValid ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
          />
          <Text style={[styles.ruleText, rule.isValid && styles.ruleTextValid]}>
            {rule.label}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderForgotPassword = () => (
    <>
      <View style={styles.verifyCard}>
        <Ionicons color={Colors.primary} name="key-outline" size={28} />
        <Text style={styles.verifyTitle}>Reset your password</Text>
        <Text style={styles.verifyText}>
          Enter your account email and Clerk will send a one-time reset code.
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setResetEmail}
          placeholder="your@email.com"
          placeholderTextColor="#777"
          style={[defaultStyles.inputField, styles.input]}
          textContentType="emailAddress"
          value={resetEmail}
        />
      </View>

      <TouchableOpacity
        disabled={isLoading}
        onPress={onSendResetCode}
        style={[defaultStyles.btn, styles.primaryButton, isLoading && styles.disabledButton]}>
        <Text style={defaultStyles.btnText}>{isLoading ? 'Sending code...' : 'Send OTP code'}</Text>
      </TouchableOpacity>

      <TouchableOpacity disabled={isLoading} onPress={switchToLogin} style={styles.forgotButton}>
        <Text style={styles.switchText}>Back to login</Text>
      </TouchableOpacity>
    </>
  );

  const renderForgotCode = () => (
    <>
      <View style={styles.verifyCard}>
        <Ionicons color={Colors.primary} name="mail-outline" size={28} />
        <Text style={styles.verifyTitle}>Check your email</Text>
        <Text style={styles.verifyText}>
          We sent a password reset code to {resetEmail.trim() || 'your email address'}.
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>OTP code</Text>
        <TextInput
          keyboardType="number-pad"
          onChangeText={setResetCode}
          placeholder="Enter code"
          placeholderTextColor="#777"
          style={[defaultStyles.inputField, styles.input, styles.codeInput]}
          value={resetCode}
        />
      </View>

      <TouchableOpacity
        disabled={isLoading}
        onPress={onVerifyResetCode}
        style={[defaultStyles.btn, styles.primaryButton, isLoading && styles.disabledButton]}>
        <Text style={defaultStyles.btnText}>{isLoading ? 'Verifying...' : 'Verify OTP'}</Text>
      </TouchableOpacity>

      <View style={styles.verifyActions}>
        <TouchableOpacity disabled={isLoading} onPress={onSendResetCode}>
          <Text style={styles.switchLink}>Resend code</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={isLoading} onPress={switchToForgotPassword}>
          <Text style={styles.switchText}>Change email</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderForgotNewPassword = () => (
    <>
      <View style={styles.verifyCard}>
        <Ionicons color={Colors.primary} name="lock-closed-outline" size={28} />
        <Text style={styles.verifyTitle}>Create new password</Text>
        <Text style={styles.verifyText}>
          Your code is verified. Set a stronger password for your account.
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>New password</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="new-password"
          onChangeText={setResetPassword}
          placeholder="Enter new password"
          placeholderTextColor="#777"
          secureTextEntry
          style={[defaultStyles.inputField, styles.input]}
          textContentType="newPassword"
          value={resetPassword}
        />
      </View>

      {renderPasswordRules(resetPasswordRules)}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="new-password"
          onChangeText={setResetConfirmPassword}
          placeholder="Repeat new password"
          placeholderTextColor="#777"
          secureTextEntry
          style={[defaultStyles.inputField, styles.input]}
          textContentType="newPassword"
          value={resetConfirmPassword}
        />
      </View>

      <TouchableOpacity
        disabled={isLoading}
        onPress={onSubmitResetPassword}
        style={[defaultStyles.btn, styles.primaryButton, isLoading && styles.disabledButton]}>
        <Text style={defaultStyles.btnText}>{isLoading ? 'Updating...' : 'Set new password'}</Text>
      </TouchableOpacity>

      <TouchableOpacity disabled={isLoading} onPress={() => setMode('forgotCode')} style={styles.forgotButton}>
        <Text style={styles.switchText}>Back to OTP code</Text>
      </TouchableOpacity>
    </>
  );

  const renderContent = () => {
    if (mode === 'login') {
      return renderLogin();
    }

    if (mode === 'signup') {
      return renderSignUp();
    }

    if (mode === 'verify') {
      return renderVerify();
    }

    if (mode === 'forgot') {
      return renderForgotPassword();
    }

    if (mode === 'forgotCode') {
      return renderForgotCode();
    }

    return renderForgotNewPassword();
  };

  const title =
    mode === 'login'
      ? 'Welcome back'
      : mode === 'signup'
        ? 'Create your account'
        : mode === 'verify'
          ? 'Verify your email'
          : mode === 'forgot'
            ? 'Forgot password'
            : mode === 'forgotCode'
              ? 'Enter OTP code'
              : 'New password';

  const subtitle =
    mode === 'login'
      ? 'Log in with email and password, or continue with a social account.'
      : mode === 'signup'
        ? 'Use a strong password. We will send an OTP code to your email.'
        : mode === 'verify'
          ? 'Enter the code to finish creating your profile.'
          : mode === 'forgot'
            ? 'We will help you securely reset your password with an email OTP.'
            : mode === 'forgotCode'
              ? 'Type the code Clerk sent to your email.'
              : 'Choose a new password that matches the requirements.';

  const shouldShowOAuth = mode === 'login' || mode === 'signup';

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {renderContent()}

      {shouldShowOAuth ? (
        <>
          <View style={styles.separatorView}>
            <View style={styles.separatorLine} />
            <Text style={styles.separator}>or</Text>
            <View style={styles.separatorLine} />
          </View>

          <View style={styles.oauthSection}>
            <TouchableOpacity
              disabled={isLoading}
              onPress={() => onSelectAuth(Strategy.Apple)}
              style={[defaultStyles.btn, styles.btnDark, isLoading && styles.disabledButton]}>
              <Ionicons name="logo-apple" size={20} style={defaultStyles.btnIcon} />
              <Text style={styles.btnDarkText}>Continue with Apple</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={isLoading}
              onPress={() => onSelectAuth(Strategy.Google)}
              style={[defaultStyles.btn, styles.btnOutline, isLoading && styles.disabledButton]}>
              <Ionicons name="logo-google" size={20} style={defaultStyles.btnIcon} />
              <Text style={styles.btnOutlineText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={isLoading}
              onPress={() => onSelectAuth(Strategy.Facebook)}
              style={[defaultStyles.btn, styles.btnOutline, isLoading && styles.disabledButton]}>
              <Ionicons name="logo-facebook" size={20} style={defaultStyles.btnIcon} />
              <Text style={styles.btnOutlineText}>Continue with Facebook</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    flexGrow: 1,
    gap: 18,
    padding: 26,
  },
  title: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 28,
  },
  subtitle: {
    color: '#646464',
    fontFamily: 'mon',
    fontSize: 14,
    lineHeight: 21,
  },
  form: {
    gap: 14,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
  },
  nameField: {
    flex: 1,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: Colors.dark,
    fontFamily: 'mon-sb',
    fontSize: 13,
  },
  input: {
    borderColor: '#D1D1D1',
    color: Colors.dark,
    fontFamily: 'mon',
    fontSize: 15,
    height: 52,
    paddingHorizontal: 14,
  },
  codeInput: {
    fontFamily: 'mon-b',
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.55,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  forgotButton: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  switchText: {
    color: '#666',
    fontFamily: 'mon',
    fontSize: 13,
  },
  switchLink: {
    color: Colors.primary,
    fontFamily: 'mon-b',
    fontSize: 13,
  },
  rulesCard: {
    backgroundColor: '#FAFAFA',
    borderColor: '#ECECEC',
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  ruleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ruleText: {
    color: '#777',
    fontFamily: 'mon',
    fontSize: 12,
  },
  ruleTextValid: {
    color: '#1E9E5A',
    fontFamily: 'mon-sb',
  },
  verifyCard: {
    alignItems: 'center',
    backgroundColor: '#FFF4F6',
    borderRadius: 18,
    gap: 8,
    padding: 18,
  },
  verifyTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 17,
  },
  verifyText: {
    color: '#666',
    fontFamily: 'mon',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  verifyActions: {
    alignItems: 'center',
    gap: 12,
  },
  separatorView: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginVertical: 2,
  },
  separatorLine: {
    backgroundColor: '#E2E2E2',
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  separator: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 13,
  },
  oauthSection: {
    gap: 12,
  },
  btnDark: {
    backgroundColor: Colors.dark,
  },
  btnDarkText: {
    color: '#fff',
    fontFamily: 'mon-sb',
    fontSize: 16,
  },
  btnOutline: {
    backgroundColor: '#fff',
    borderColor: '#CFCFCF',
    borderWidth: 1,
  },
  btnOutlineText: {
    color: Colors.dark,
    fontFamily: 'mon-sb',
    fontSize: 16,
  },
});

export default Login;
