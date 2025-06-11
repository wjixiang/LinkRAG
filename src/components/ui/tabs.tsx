import * as React from 'react';

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, value, onValueChange, children, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={`flex flex-col gap-2 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

interface TabsListProps {
  className?: string;
  children: React.ReactNode;
}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

interface TabsTriggerProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 
          data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md
          hover:bg-accent hover:text-accent-foreground
          ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

interface TabsContentProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`mt-2 rounded-lg border bg-background p-6 shadow-sm transition-all ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
