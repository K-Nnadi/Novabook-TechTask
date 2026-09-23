import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './api/orchestration/health/health.module';
import { SaleModule } from './api/orchestration/sale/sale.module';
import { TaxPositionModule } from './api/orchestration/taxPosition/taxPosition.module';
import { TransactionsModule } from './api/orchestration/transactions/transactions.module';
import { SaleAmendment } from './api/modules/saleAmendment/saleAmendment.entity';
import { SaleAmendmentModule } from './api/modules/saleAmendment/saleAmendment.module';
import { SaleEvent } from './api/modules/saleEvent/saleEvent.entity';
import { SaleEventModule } from './api/modules/saleEvent/saleEvent.module';
import { TaxPaymentEvent } from './api/modules/taxPaymentEvent/taxPaymentEvent.entity';
import { TaxPaymentEventModule } from './api/modules/taxPaymentEvent/taxPaymentEvent.module';
import appConfig, { AppSettings } from './config/app.config';
import { InitialTaxLedger1710000000000 } from './migrations/1710000000000-InitialTaxLedger';
import { ensureSqliteDirectory } from './sqlite.path';

const Modules = [SaleEventModule, TaxPaymentEventModule, SaleAmendmentModule];

const Orchestration = [
  TransactionsModule,
  SaleModule,
  TaxPositionModule,
  HealthModule,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { sqlitePath: database } = config.getOrThrow<AppSettings>('app');
        const memory = database === ':memory:';
        if (!memory) {
          ensureSqliteDirectory(database);
        }
        return {
          type: 'sqljs' as const,
          autoSave: !memory,
          location: memory ? undefined : database,
          entities: [SaleEvent, TaxPaymentEvent, SaleAmendment],
          migrations: [InitialTaxLedger1710000000000],
          migrationsRun: true,
          synchronize: false,
        };
      },
    }),
    ...Modules,
    ...Orchestration,
  ],
})
export class AppModule {}
