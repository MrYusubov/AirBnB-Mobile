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

type AuthMode = 'login' | 'signup' | 'verify';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const passwordRules = useMemo(
    () => [
      { label: 'Minimum 6 characters', isValid: password.length >= 6 },
      { label: 'At least 1 uppercase letter', isValid: /[A-Z]/.test(password) },
      { label: 'At least 1 number', isValid: /\d/.test(password) },
      { label: 'At least 1 symbol', isValid: /[^A-Za-z0-9]/.test(password) },
    ],
    [password],
  );
  const isPasswordValid = passwordRules.every((rule) => rule.isValid);

  const resetSignUpFields = () => {
    setConfirmPassword('');
    setCode('');
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
        router.back();
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
        router.back();
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
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password || !confirmPassword) {
      Alert.alert('Missing info', 'Please fill email, password, and confirm password.');
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
        router.back();
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

  const switchToLogin = () => {
    setMode('login');
    resetSignUpFields();
  };

  const switchToSignUp = () => {
    setMode('signup');
    resetSignUpFields();
  };

  const renderEmailPasswordFields = () => (
    <View style={styles.form}>
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

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>
        {mode === 'login'
          ? 'Welcome back'
          : mode === 'signup'
            ? 'Create your account'
            : 'Verify your email'}
      </Text>
      <Text style={styles.subtitle}>
        {mode === 'login'
          ? 'Log in with email and password, or continue with a social account.'
          : mode === 'signup'
            ? 'Use a strong password. We will send an OTP code to your email.'
            : 'Enter the code to finish creating your profile.'}
      </Text>

      {mode === 'login' ? renderLogin() : mode === 'signup' ? renderSignUp() : renderVerify()}

      {mode !== 'verify' ? (
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
