import { Type } from 'class-transformer'
import { IsNumber, IsString, Min } from 'class-validator'
export class CreateOrderDto 
{
  @IsString()
  public name: string
}