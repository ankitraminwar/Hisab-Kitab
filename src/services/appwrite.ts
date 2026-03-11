import { TransactionEntity } from "@/modules/transactions/transactionsService";
import { Client, Databases } from "appwrite";

const client = new Client();

export const configureAppwrite = (endpoint: string, project: string) => {
  client.setEndpoint(endpoint).setProject(project);
};

export const syncTransactionToCloud = async (
  transaction: TransactionEntity,
) => {
  const databases = new Databases(client);
  const databaseId = "default";
  const collectionId = "transactions";
  try {
    await databases.createDocument(databaseId, collectionId, transaction.id, {
      ...transaction,
      date: transaction.date,
      updatedAt: transaction.updatedAt,
      createdAt: transaction.createdAt,
    });
  } catch (err) {
    if ((err as any)?.code === 409) {
      await databases.updateDocument(databaseId, collectionId, transaction.id, {
        ...transaction,
      });
    } else {
      throw err;
    }
  }
};

export const downloadTransactionsFromCloud = async (): Promise<
  TransactionEntity[]
> => {
  const databases = new Databases(client);
  const databaseId = "default";
  const collectionId = "transactions";
  const response = await databases.listDocuments(databaseId, collectionId);
  return (response.documents || []) as unknown as TransactionEntity[];
};
