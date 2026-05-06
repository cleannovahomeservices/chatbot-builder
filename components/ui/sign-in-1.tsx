import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface AuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  logoSrc: string;
  logoAlt?: string;
  title: string;
  description?: string;
  primaryAction: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
  secondaryActions?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
  }[];
  skipAction?: {
    label: string;
    onClick: () => void;
  };
  footerContent?: React.ReactNode;
}

const AuthForm = React.forwardRef<HTMLDivElement, AuthFormProps>(
  (
    {
      className,
      logoSrc,
      logoAlt = "Logo",
      title,
      description,
      primaryAction,
      secondaryActions,
      skipAction,
      footerContent,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn("flex flex-col items-center justify-center", className)}>
        <Card ref={ref} className="w-full max-w-sm" {...props}>
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt={logoAlt} className="h-12 w-12 object-contain rounded-xl" />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>

          <CardContent className="grid gap-4">
            <Button
              onClick={primaryAction.onClick}
              className="w-full cursor-pointer"
            >
              {primaryAction.icon}
              {primaryAction.label}
            </Button>

            {secondaryActions && secondaryActions.length > 0 && (
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">o</span>
                </div>
              </div>
            )}

            <div className="grid gap-2">
              {secondaryActions?.map((action, index) => (
                <Button
                  key={index}
                  variant="secondary"
                  className="w-full cursor-pointer"
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
            </div>
          </CardContent>

          {skipAction && (
            <CardFooter className="flex flex-col">
              <Button
                variant="outline"
                className="w-full cursor-pointer"
                onClick={skipAction.onClick}
              >
                {skipAction.label}
              </Button>
            </CardFooter>
          )}
        </Card>

        {footerContent && (
          <div className="mt-6 w-full max-w-sm px-8 text-center text-sm text-muted-foreground">
            {footerContent}
          </div>
        )}
      </div>
    );
  }
);
AuthForm.displayName = "AuthForm";

export { AuthForm };
