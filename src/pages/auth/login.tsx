import { AuthForm } from '@/components/custom/auth-form';
import { motion } from 'framer-motion';

export function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <h1 className="text-4xl font-bold text-center mb-8">allthing</h1>
        <AuthForm type="login" />
      </motion.div>
    </div>
  );
}
