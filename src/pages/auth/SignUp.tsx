import { useState } from 'react';
import { Link } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import { motion } from 'framer-motion';
import {
  EnvelopeIcon,
  LockClosedIcon,
  ArrowRightIcon,
  IdentificationIcon,
  UserIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim() ?? '';
const shouldUseRecaptcha = Boolean(recaptchaSiteKey);

const SignUp = () => {
  const [formData, setFormData] = useState({
    role: 'Faculty Staff',
    idNumber: '',
    firstname: '',
    middlename: '',
    lastname: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverMessage, setServerMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors((currentErrors) => ({ ...currentErrors, [name]: '' }));
    setServerMessage('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerMessage('');
    setIsSuccess(false);

    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }

    if (shouldUseRecaptcha && !captcha) {
      setServerMessage('Please complete the reCAPTCHA before creating your account.');
      setIsSuccess(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/signup.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrors(result.errors ?? {});
        setServerMessage(result.message ?? 'Unable to create account.');
        return;
      }

      setErrors({});
      setIsSuccess(true);
      setServerMessage(result.message ?? 'Account created successfully.');
      setFormData({
        role: 'Faculty Staff',
        idNumber: '',
        firstname: '',
        middlename: '',
        lastname: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
      setCaptcha(null);
    } catch {
      setServerMessage('Unable to connect to the PHP signup service. Make sure Apache and MySQL are running in XAMPP.');
      setIsSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-shell min-h-screen flex items-center justify-center p-6 sm:p-12">
      <div className="auth-grid" />
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <div className="auth-wave auth-wave-top" />
      <div className="auth-wave auth-wave-bottom" />

      <div className="auth-card w-full max-w-[520px] rounded-[2.5rem] p-8 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black text-slate-900 mb-2">Create Account</h2>
            <p className="text-slate-500 font-medium">Register as faculty staff/property custodian to start managing supplies.</p>
          </div>

          {serverMessage && (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
                isSuccess
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {serverMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Role</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                  <UserIcon className="h-5 w-5" />
                </div>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all appearance-none"
                >
                  <option value="Faculty Staff">Faculty Staff</option>
                  <option value="Property Custodian">Property Custodian</option>
                </select>
              </div>
              {errors.role && <p className="mt-2 text-xs font-semibold text-rose-600">{errors.role}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ID Number</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <IdentificationIcon className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    name="idNumber"
                    placeholder="2024-0001"
                    value={formData.idNumber}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    required
                  />
                </div>
                {errors.idNumber && <p className="mt-2 text-xs font-semibold text-rose-600">{errors.idNumber}</p>}
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">First Name</label>
                <input
                  type="text"
                  name="firstname"
                  placeholder="Elysia"
                  value={formData.firstname}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  required
                />
                {errors.firstname && <p className="mt-2 text-xs font-semibold text-rose-600">{errors.firstname}</p>}
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Middle Name</label>
                <input
                  type="text"
                  name="middlename"
                  placeholder="V."
                  value={formData.middlename}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Last Name</label>
                <input
                  type="text"
                  name="lastname"
                  placeholder="Lysander"
                  value={formData.lastname}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  required
                />
                {errors.lastname && <p className="mt-2 text-xs font-semibold text-rose-600">{errors.lastname}</p>}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    name="username"
                    placeholder="elysia_l"
                    value={formData.username}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    required
                  />
                </div>
                {errors.username && <p className="mt-2 text-xs font-semibold text-rose-600">{errors.username}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                    <EnvelopeIcon className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    placeholder="elysia.lysander@university.edu"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    required
                  />
                </div>
                {errors.email && <p className="mt-2 text-xs font-semibold text-rose-600">{errors.email}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Create Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                      <LockClosedIcon className="h-5 w-5" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Min. 8 characters"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-2 text-xs font-semibold text-rose-600">{errors.password}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                      <LockClosedIcon className="h-5 w-5" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="Repeat password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="mt-2 text-xs font-semibold text-rose-600">{errors.confirmPassword}</p>}
                </div>
              </div>
            </div>

            {shouldUseRecaptcha ? (
              <div className="py-2 flex justify-center">
                <ReCAPTCHA
                  sitekey={recaptchaSiteKey}
                  onChange={setCaptcha}
                  className="transform scale-[0.85] origin-center"
                />
              </div>
            ) : null}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || (shouldUseRecaptcha && !captcha)}
                className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold text-sm shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
                {!isSubmitting && <ArrowRightIcon className="w-4 h-4" />}
              </button>
            </div>
          </form>

          <div className="mt-10 text-center">
            <p className="text-sm text-slate-500 font-medium">
              Already have an account?{" "}
              <Link to="/auth/login" className="text-primary-600 font-bold hover:underline">
                Sign In instead
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SignUp;
