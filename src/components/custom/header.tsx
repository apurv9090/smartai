import { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from './sidebar';
import { Menu, Moon, Sun, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const theme = useTheme();
  const { user, logout } = useAuth();

  useEffect(() => {
    // Check if document has the 'dark' class to determine current theme
    setIsDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDarkMode;
    setIsDarkMode(newIsDark);
    
    // Toggle the 'dark' class on the document element
    if (newIsDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // If theme context has a toggle method, use it too
    if (typeof theme.toggleTheme === 'function') {
      theme.toggleTheme();
    }
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center border-b border-border bg-background px-4">
      <div className="flex flex-1 items-center justify-between">
        {/* Left side with menu button and title */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
          <h1 className="text-lg font-semibold">allthing</h1>
        </div>
        
  {/* Connection status indicator removed as requested */}
        
        {/* Right side with theme toggle and logout */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle Theme"
          >
            {isDarkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          
          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              aria-label="Logout"
              title={`Logout (${user.name})`}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
      
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
    </header>
  );
}