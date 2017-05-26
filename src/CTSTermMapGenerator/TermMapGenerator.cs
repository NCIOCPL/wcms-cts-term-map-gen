using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using NCI.Services.LexEVSCTS2;
using Newtonsoft.Json.Linq;
using Common.Logging;

namespace CTSTermMapGenerator
{
    class TermMapGenerator
    {
        static ILog log = LogManager.GetLogger(typeof(TermMapGenerator));
        static NCIThesaurusTermLoader termLoader = new NCIThesaurusTermLoader("lexevscts2.nci.nih.gov");

        static void Main(string[] args)
        {
            log.Info("Map Generator Starting");

            Task mapGen = GenerateTermsMap(new string[] { "C7057" });
            
            mapGen.Wait();

            log.Info("Map Generator Finished");

            Console.Read();
        }

        static Task GenerateTermsMap(string[] ids)
        {
            return Task.WhenAll(ids.Select(i => FetchAndWrite(i)));
        }

        static async Task FetchAndWrite(string entityID)
        {
            ThesaurusTerm term = await termLoader.GetTerm(entityID);

            await FetchAndWrite(term);
        }

        static async Task FetchAndWrite(ThesaurusTerm term)
        {            
            log.Info(term.ToString());

            ThesaurusTerm[] childTerms = await termLoader.GetChildTerms(term.EntityID);

            if (childTerms.Length > 0)
            {
                await Task.WhenAll(childTerms.Select(ct => FetchAndWrite(ct)));
            }
        }

    }
}
