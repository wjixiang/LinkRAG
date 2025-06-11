import * as React from 'react';

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export declare const Tabs: React.ForwardRefExoticComponent<
  TabsProps & React.RefAttributes<HTMLDivElement>
>;

export declare const TabsList: React.ForwardRefExoticComponent<
  TabsListProps & React.RefAttributes<HTMLDivElement>
>;

export declare const TabsTrigger: React.ForwardRefExoticComponent<
  TabsTriggerProps & React.RefAttributes<HTMLButtonElement>
>;

export declare const TabsContent: React.ForwardRefExoticComponent<
  TabsContentProps & React.RefAttributes<HTMLDivElement>
>;