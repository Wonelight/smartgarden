import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Hook để tạo optimistic mutation với rollback tự động khi lỗi
 */
export function useOptimisticMutation<TData, TVariables, TContext = unknown>({
    mutationFn,
    queryKey,
    onMutate,
    onError,
    onSuccess,
    onSettled,
    optimisticUpdate,
    successMessage,
    errorMessage,
    ...options
}: {
    mutationFn: (variables: TVariables) => Promise<TData>;
    queryKey: readonly unknown[];
    optimisticUpdate?: (variables: TVariables, oldData: unknown) => unknown;
    successMessage?: string | ((data: TData) => string);
    errorMessage?: string | ((error: Error) => string);
} & Omit<UseMutationOptions<TData, Error, TVariables, TContext>, 'mutationFn'>) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn,
        onMutate: async (variables) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey });

            // Snapshot previous value
            const previousData = queryClient.getQueryData(queryKey);

            // Optimistically update
            if (optimisticUpdate) {
                const newData = optimisticUpdate(variables, previousData);
                queryClient.setQueryData(queryKey, newData);
            }

            // Custom onMutate
            // @ts-ignore
            const context = onMutate ? await onMutate(variables) : undefined;

            return { previousData, context } as TContext;
        },
        onError: (error, variables, context) => {
            // Rollback on error
            const ctx = context as { previousData: unknown } | undefined;
            if (ctx?.previousData !== undefined) {
                queryClient.setQueryData(queryKey, ctx.previousData);
            }

            const message = typeof errorMessage === 'function' ? errorMessage(error) : errorMessage || 'Có lỗi xảy ra';
            toast.error(message);

            if (onError) {
                // @ts-ignore
                onError(error, variables, context);
            }
        },
        onSuccess: (data, variables, context) => {
            // Invalidate to refetch fresh data
            queryClient.invalidateQueries({ queryKey });

            const message = typeof successMessage === 'function' ? successMessage(data) : successMessage;
            if (message) {
                toast.success(message);
            }

            if (onSuccess) {
                // @ts-ignore
                onSuccess(data, variables, context);
            }
        },
        onSettled: (data, error, variables, context) => {
            // Always refetch after mutation
            queryClient.invalidateQueries({ queryKey });

            if (onSettled) {
                // @ts-ignore
                onSettled(data, error, variables, context);
            }
        },
        ...options,
    });
}
