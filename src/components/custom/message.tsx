import { motion } from 'framer-motion';
import { cx } from 'classix';
import { SparklesIcon } from './icons';
import { Markdown } from './markdown';
import { message } from "../../interfaces/interfaces"
import { MessageActions } from '@/components/custom/actions';

export const PreviewMessage = ({ message }: { message: message; }) => {

  return (
    <motion.div
    className="w-full mx-auto max-w-4xl px-3 sm:px-4 group/message"
    initial={{ y: 6, x: message.role === 'assistant' ? -12 : 12, opacity: 0 }}
    animate={{ y: 0, x: 0, opacity: 1, transition: { type: 'spring', stiffness: 260, damping: 22 } }}
      data-role={message.role}
    >
      <div
        className={cx(
          // Container bubble styling
      'flex gap-3 w-full rounded-2xl transition-shadow hover:shadow-sm',
          // Assistant bubble
      'group-data-[role=assistant]/message:bg-background group-data-[role=assistant]/message:border group-data-[role=assistant]/message:border-border group-data-[role=assistant]/message:px-4 group-data-[role=assistant]/message:py-3 group-data-[role=assistant]/message:w-fit group-data-[role=assistant]/message:max-w-3xl group-data-[role=assistant]/message:ml-1 md:group-data-[role=assistant]/message:ml-2',
          // User bubble
      'group-data-[role=user]/message:bg-primary group-data-[role=user]/message:text-primary-foreground group-data-[role=user]/message:px-4 group-data-[role=user]/message:py-3 group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:mr-1 md:group-data-[role=user]/message:mr-2 group-data-[role=user]/message:max-w-3xl'
        )}
      >
        {message.role === 'assistant' && (
      <div className="size-8 mt-0.5 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-muted/60">
            <SparklesIcon size={14} />
          </div>
        )}

        <div className="flex flex-col w-full">
          {message.content && (
            <div className="flex flex-col gap-3 text-left leading-relaxed">
              {message.filtered && (
                <div className="text-amber-600 dark:text-amber-400 text-xs mb-1 italic">
                  ⚠️ This response was filtered by Gemini AI content safety systems
                </div>
              )}
              <Markdown>{message.content}</Markdown>
            </div>
          )}

          {message.role === 'assistant' && (
            <MessageActions message={message} />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 0.2 } }}
      data-role={role}
    >
      <div
        className={cx(
          // Keep layout, but ensure loading bubble is minimal and clean
          'flex items-center gap-2 w-full rounded-2xl group-data-[role=assistant]/message:w-fit group-data-[role=assistant]/message:max-w-3xl group-data-[role=assistant]/message:ml-1 md:group-data-[role=assistant]/message:ml-2'
        )}
      >
        {/* Agent icon without background box */}
        <div className="mt-0.5 shrink-0 flex items-center justify-center">
          <span className="text-muted-foreground opacity-80">
            <SparklesIcon size={16} />
          </span>
        </div>
        {/* Typing dots next to icon */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.2s]"></span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.1s]"></span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-bounce"></span>
        </div>
      </div>
    </motion.div>
  );
};
