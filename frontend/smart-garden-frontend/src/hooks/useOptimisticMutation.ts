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
    queryKey: string | string[];
    optimisticUpdate?: (variables: TVariables, oldData: unknown) => unknown;
    successMessage?: string | ((data: TData) => string);
    errorMessage?: string | ((error: Error) => string);
} & Omit<UseMutationOptions<TData, Error, TVariables, TContext>, 'mutationFn'>) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn,
        onMutate: async (variables) => {
            // Cancel outgoing refetches
            const queryKeys = Array.isArray(queryKey) ? queryKey : [queryKey];
            await Promise.all(
                queryKeys.map((key) => queryClient.cancelQueries({ queryKey: key }))
            );

            // Snapshot previous value
            const previousData = queryKeys.map((key) => queryClient.getQueryData(key));

            // Optimistically update
            if (optimisticUpdate) {
                queryKeys.forEach((key, index) => {
                    const oldData = previousData[index];
                    const newData = optimisticUpdate(variables, oldData);
                    queryClient.setQueryData(key, newData);
                });
            }

            // Custom onMutate
            const context = onMutate ? await onMutate(variables) : undefined;

            return { previousData, context } as TContext;
        },
        onError: (error, variables, context) => {
            // Rollback on error
            const queryKeys = Array.isArray(queryKey) ? queryKey : [queryKey];
            const ctx = context as { previousData: unknown[] } | undefined;
            if (ctx?.previousData) {
                queryKeys.forEach((key, index) => {
                    queryClient.setQueryData(key, ctx.previousData[index]);
                });
            }

            const message = typeof errorMessage === 'function' ? errorMessage(error) : errorMessage || 'Có lỗi xảy ra';
            toast.error(message);

            if (onError) {
                onError(error, variables, context);
            }
        },
        onSuccess: (data, variables, context) => {
            // Invalidate to refetch fresh data
            const queryKeys = Array.isArray(queryKey) ? queryKey : [queryKey];
            queryKeys.forEach((key) => {
                queryClient.invalidateQueries({ queryKey: key });
            });

            const message = typeof successMessage === 'function' ? successMessage(data) : successMessage;
            if (message) {
                toast.success(message);
            }

            if (onSuccess) {
                onSuccess(data, variables, context);
            }
        },
        onSettled: (data, error, variables, context) => {
            // Always refetch after mutation
            const queryKeys = Array.isArray(queryKey) ? queryKey : [queryKey];
            queryKeys.forEach((key) => {
                queryClient.invalidateQueries({ queryKey: key });
            });

            if (onSettled) {
                onSettled(data, error, variables, context);
            }
        },
        ...options,
    });
}
